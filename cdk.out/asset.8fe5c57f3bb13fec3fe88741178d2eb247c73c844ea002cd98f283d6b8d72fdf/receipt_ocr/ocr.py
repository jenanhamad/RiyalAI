import json
import boto3
import os
from datetime import datetime
import re
from decimal import Decimal

# Initialize AWS clients
textract = boto3.client('textract')
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')

TABLE_NAME = os.environ.get('TABLE_NAME')
BUCKET_NAME = os.environ.get('BUCKET')

def handler(event, context):
    """
    Receipt OCR Lambda function
    Extracts text from receipt images using AWS Textract
    """
    print(f"Receipt OCR received event: {json.dumps(event)}")
    
    try:
        # Handle S3 trigger event
        if 'Records' in event:
            for record in event['Records']:
                if record['eventSource'] == 'aws:s3':
                    bucket = record['s3']['bucket']['name']
                    key = record['s3']['object']['key']
                    
                    # Process the uploaded receipt
                    result = process_receipt(bucket, key)
                    print(f"Processed receipt {key}: {result}")
        
        # Handle direct API call
        elif 'receiptKey' in event:
            bucket = event.get('bucket', BUCKET_NAME)
            key = event['receiptKey']
            result = process_receipt(bucket, key)
            return {
                'statusCode': 200,
                'body': json.dumps(result)
            }
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Receipt OCR completed successfully',
                'timestamp': datetime.utcnow().isoformat()
            })
        }
        
    except Exception as e:
        print(f"Error in receipt OCR: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Failed to extract text from receipt',
                'message': str(e)
            })
        }

def process_receipt(bucket, key):
    """Process a single receipt image"""
    try:
        print(f"Processing receipt: s3://{bucket}/{key}")
        
        # Call Textract to extract text
        response = textract.detect_document_text(
            Document={
                'S3Object': {
                    'Bucket': bucket,
                    'Name': key
                }
            }
        )
        
        # Extract text from Textract response
        extracted_text = extract_text_from_response(response)
        print(f"Extracted text: {extracted_text}")
        
        # Parse receipt data
        receipt_data = parse_receipt_text(extracted_text)
        print(f"Parsed receipt data: {receipt_data}")
        
        # Try to find associated expense record and update it
        expense_id = extract_expense_id_from_key(key)
        if expense_id and TABLE_NAME:
            update_expense_with_receipt_data(expense_id, receipt_data)
        
        return {
            'success': True,
            'extractedText': extracted_text,
            'parsedData': receipt_data,
            'expenseId': expense_id
        }
        
    except Exception as e:
        print(f"Error processing receipt {key}: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def extract_text_from_response(textract_response):
    """Extract all text from Textract response"""
    text_lines = []
    
    for block in textract_response.get('Blocks', []):
        if block['BlockType'] == 'LINE':
            text_lines.append(block['Text'])
    
    return '\n'.join(text_lines)

def parse_receipt_text(text):
    """Parse receipt text to extract key information"""
    lines = text.split('\n')
    
    receipt_data = {
        'merchant': None,
        'amount': None,
        'date': None,
        'items': [],
        'confidence': 'medium'
    }
    
    # Extract merchant (usually first few lines)
    for i, line in enumerate(lines[:5]):
        line = line.strip()
        if len(line) > 3 and not re.match(r'^[\d\s\-\/]+$', line):
            if not receipt_data['merchant']:
                receipt_data['merchant'] = line
                break
    
    # Extract total amount
    amount_patterns = [
        r'total[:\s]*\$?(\d+\.?\d*)',
        r'amount[:\s]*\$?(\d+\.?\d*)',
        r'\$(\d+\.\d{2})',
        r'(\d+\.\d{2})\s*$'
    ]
    
    for line in lines:
        line_lower = line.lower().strip()
        for pattern in amount_patterns:
            match = re.search(pattern, line_lower)
            if match:
                try:
                    amount = float(match.group(1))
                    if amount > 0 and (not receipt_data['amount'] or amount > receipt_data['amount']):
                        receipt_data['amount'] = amount
                except ValueError:
                    continue
    
    # Extract date
    date_patterns = [
        r'(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})',
        r'(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})',
        r'(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}[,\s]+\d{4}'
    ]
    
    for line in lines:
        line_lower = line.lower().strip()
        for pattern in date_patterns:
            match = re.search(pattern, line_lower)
            if match:
                receipt_data['date'] = match.group(1)
                break
        if receipt_data['date']:
            break
    
    # Extract items (lines with prices)
    for line in lines:
        line = line.strip()
        # Look for lines that might be items with prices
        if re.search(r'\$?\d+\.\d{2}', line) and len(line) > 5:
            # Skip total lines
            if not re.search(r'(total|subtotal|tax|amount)', line.lower()):
                receipt_data['items'].append(line)
    
    # Set confidence based on how much data we extracted
    extracted_fields = sum([
        1 if receipt_data['merchant'] else 0,
        1 if receipt_data['amount'] else 0,
        1 if receipt_data['date'] else 0
    ])
    
    if extracted_fields >= 3:
        receipt_data['confidence'] = 'high'
    elif extracted_fields >= 2:
        receipt_data['confidence'] = 'medium'
    else:
        receipt_data['confidence'] = 'low'
    
    return receipt_data

def extract_expense_id_from_key(key):
    """Extract expense ID from S3 key if it follows a pattern"""
    # Assuming key format like: receipts/{expenseId}/receipt.jpg
    parts = key.split('/')
    if len(parts) >= 2:
        return parts[-2]  # Second to last part should be expense ID
    return None

def update_expense_with_receipt_data(expense_id, receipt_data):
    """Update expense record with extracted receipt data"""
    try:
        if not TABLE_NAME:
            print("No table name provided, skipping expense update")
            return
        
        table = dynamodb.Table(TABLE_NAME)
        
        # Build update expression
        update_expression = "SET updatedAt = :updatedAt, receiptProcessed = :processed"
        expression_values = {
            ":updatedAt": datetime.utcnow().isoformat(),
            ":processed": True
        }
        
        # Update fields if we extracted them and they're not already set
        if receipt_data.get('merchant'):
            update_expression += ", extractedMerchant = :merchant"
            expression_values[":merchant"] = receipt_data['merchant']
        
        if receipt_data.get('amount'):
            update_expression += ", extractedAmount = :amount"
            expression_values[":amount"] = Decimal(str(receipt_data['amount']))
        
        if receipt_data.get('date'):
            update_expression += ", extractedDate = :date"
            expression_values[":date"] = receipt_data['date']
        
        if receipt_data.get('items'):
            update_expression += ", extractedItems = :items"
            expression_values[":items"] = receipt_data['items']
        
        update_expression += ", extractionConfidence = :confidence"
        expression_values[":confidence"] = receipt_data.get('confidence', 'medium')
        
        # Update the expense record
        table.update_item(
            Key={'expenseId': expense_id},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values
        )
        
        print(f"Updated expense {expense_id} with receipt data")
        
    except Exception as e:
        print(f"Error updating expense {expense_id}: {str(e)}")

def categorize_expense_from_merchant(merchant):
    """Simple merchant-based categorization"""
    if not merchant:
        return 'Other'
    
    merchant_lower = merchant.lower()
    
    # Food & Dining
    food_keywords = ['restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'food', 'diner', 'bistro', 'grill']
    if any(keyword in merchant_lower for keyword in food_keywords):
        return 'Food & Dining'
    
    # Gas stations
    gas_keywords = ['shell', 'exxon', 'bp', 'chevron', 'mobil', 'gas', 'fuel']
    if any(keyword in merchant_lower for keyword in gas_keywords):
        return 'Gas'
    
    # Grocery stores
    grocery_keywords = ['market', 'grocery', 'supermarket', 'walmart', 'target', 'costco']
    if any(keyword in merchant_lower for keyword in grocery_keywords):
        return 'Groceries'
    
    # Transportation
    transport_keywords = ['uber', 'lyft', 'taxi', 'metro', 'transit', 'parking']
    if any(keyword in merchant_lower for keyword in transport_keywords):
        return 'Transportation'
    
    return 'Other'
