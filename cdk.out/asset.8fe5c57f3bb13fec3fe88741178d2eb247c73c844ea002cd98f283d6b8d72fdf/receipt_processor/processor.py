import json
import boto3
import os
from datetime import datetime

def handler(event, context):
    """
    Receipt processor Lambda function
    Processes receipt images and extracts expense data
    """
    print(f"Receipt processor received event: {json.dumps(event)}")
    
    try:
        # Process receipt image
        # This would contain logic to:
        # 1. Analyze receipt image
        # 2. Extract merchant, amount, date, items
        # 3. Update expense record in DynamoDB
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Receipt processed successfully',
                'timestamp': datetime.utcnow().isoformat()
            })
        }
        
    except Exception as e:
        print(f"Error processing receipt: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Failed to process receipt',
                'message': str(e)
            })
        }
