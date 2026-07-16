from datetime import datetime
import os
import uuid
import json
import boto3
import base64
from decimal import Decimal
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource("dynamodb")
s3 = boto3.client("s3")
TABLE_NAME = os.environ["TABLE_NAME"]
BUCKET = os.environ.get("BUCKET", "")
table = dynamodb.Table(TABLE_NAME)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def create_response(status_code, body, headers=None):
    response_headers = CORS_HEADERS.copy()
    if headers:
        response_headers.update(headers)
    return {
        "statusCode": status_code,
        "headers": response_headers,
        "body": json.dumps(body, cls=DecimalEncoder) if isinstance(body, (dict, list)) else body,
    }


def extract_user_id(event):
    auth_header = event.get("headers", {}).get("Authorization") or event.get("headers", {}).get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            token = auth_header.replace("Bearer ", "")
            parts = token.split(".")
            if len(parts) >= 2:
                payload_encoded = parts[1]
                payload_encoded += "=" * (4 - len(payload_encoded) % 4)
                payload = json.loads(base64.b64decode(payload_encoded))
                return payload.get("sub") or payload.get("cognito:username") or payload.get("username")
        except Exception as e:
            print(f"JWT parse error: {e}")

    if "requestContext" in event and "authorizer" in event["requestContext"]:
        authorizer = event["requestContext"]["authorizer"]
        if isinstance(authorizer, dict):
            claims = authorizer.get("claims", {})
            return claims.get("sub") or claims.get("cognito:username") or authorizer.get("principalId")

    return None


def health_check():
    return create_response(200, {
        "status": "healthy",
        "service": "RiyalAI",
        "timestamp": datetime.utcnow().isoformat(),
    })


def list_expenses(user_id):
    response = table.scan(FilterExpression=Attr("userId").eq(user_id))
    items = response.get("Items", [])
    return create_response(200, {"expenses": items, "count": len(items)})


def create_expense(body, user_id):
    if not body.get("merchant") or not body.get("amount"):
        return create_response(400, {"error": "Merchant and amount are required"})

    try:
        amount = float(body.get("amount"))
        if amount <= 0:
            return create_response(400, {"error": "Amount must be positive"})
    except (ValueError, TypeError):
        return create_response(400, {"error": "Invalid amount format"})

    expense_id = str(uuid.uuid4())
    expense_item = {
        "expenseId": expense_id,
        "userId": user_id,
        "merchant": body.get("merchant", ""),
        "amount": Decimal(str(amount)),
        "date": body.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
        "category": body.get("category", "Other"),
        "paymentMethod": body.get("paymentMethod", "Credit Card"),
        "description": body.get("description", ""),
        "notes": body.get("notes", ""),
        "createdAt": datetime.utcnow().isoformat(),
        "updatedAt": datetime.utcnow().isoformat(),
        "status": "processed",
        "hasReceipt": body.get("hasReceipt", False),
        "isRecurring": False,
        "tags": [],
    }

    if body.get("receiptKey"):
        expense_item["receiptKey"] = body.get("receiptKey")

    table.put_item(Item=expense_item)
    return create_response(201, {
        "message": "Expense created successfully",
        "expenseId": expense_id,
        "expense": json.loads(json.dumps(expense_item, cls=DecimalEncoder)),
    })


def get_expense(expense_id, user_id):
    resp = table.get_item(Key={"expenseId": expense_id})
    if "Item" not in resp:
        return create_response(404, {"error": "Expense not found"})
    expense = resp["Item"]
    if expense.get("userId") != user_id:
        return create_response(403, {"error": "Access denied"})
    return create_response(200, json.loads(json.dumps(expense, cls=DecimalEncoder)))


def update_expense(expense_id, body, user_id):
    resp = table.get_item(Key={"expenseId": expense_id})
    if "Item" not in resp:
        return create_response(404, {"error": "Expense not found"})
    if resp["Item"].get("userId") != user_id:
        return create_response(403, {"error": "Access denied"})

    update_expression = "SET updatedAt = :updatedAt"
    expression_values = {":updatedAt": datetime.utcnow().isoformat()}

    for field in ["merchant", "amount", "category", "paymentMethod", "description", "notes", "date", "receiptKey", "hasReceipt"]:
        if field in body:
            if field == "amount":
                amount = float(body[field])
                if amount <= 0:
                    return create_response(400, {"error": "Amount must be positive"})
                expression_values[f":{field}"] = Decimal(str(amount))
            else:
                expression_values[f":{field}"] = body[field]
            update_expression += f", {field} = :{field}"

    if len(expression_values) > 1:
        table.update_item(
            Key={"expenseId": expense_id},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values,
        )

    return create_response(200, {"message": "Expense updated successfully"})


def delete_expense(expense_id, user_id):
    resp = table.get_item(Key={"expenseId": expense_id})
    if "Item" not in resp:
        return create_response(404, {"error": "Expense not found"})
    if resp["Item"].get("userId") != user_id:
        return create_response(403, {"error": "Access denied"})
    table.delete_item(Key={"expenseId": expense_id})
    return create_response(200, {"message": "Expense deleted successfully"})


def toggle_recurring_expense(expense_id, user_id):
    resp = table.get_item(Key={"expenseId": expense_id})
    if "Item" not in resp:
        return create_response(404, {"error": "Expense not found"})
    expense = resp["Item"]
    if expense.get("userId") != user_id:
        return create_response(403, {"error": "Access denied"})

    is_recurring = not expense.get("isRecurring", False)
    table.update_item(
        Key={"expenseId": expense_id},
        UpdateExpression="SET isRecurring = :recurring, updatedAt = :updatedAt",
        ExpressionAttributeValues={
            ":recurring": is_recurring,
            ":updatedAt": datetime.utcnow().isoformat(),
        },
    )
    return create_response(200, {
        "message": f"Expense marked as {'recurring' if is_recurring else 'one-time'}",
        "isRecurring": is_recurring,
    })


def get_recurring_expenses(user_id):
    response = table.scan(
        FilterExpression=Attr("userId").eq(user_id) & Attr("isRecurring").eq(True)
    )
    items = response.get("Items", [])
    monthly_total = sum(float(item.get("amount", 0)) for item in items)
    return create_response(200, {
        "recurringExpenses": json.loads(json.dumps(items, cls=DecimalEncoder)),
        "monthlyTotal": monthly_total,
        "count": len(items),
    })


def get_expense_analytics(user_id):
    response = table.scan(FilterExpression=Attr("userId").eq(user_id))
    expenses = response.get("Items", [])

    if not expenses:
        return create_response(200, {
            "totalExpenses": 0,
            "categoryBreakdown": {},
            "monthlyTrend": {},
            "recurringTotal": 0,
        })

    total = sum(float(e.get("amount", 0)) for e in expenses)
    categories = {}
    monthly_trend = {}

    for expense in expenses:
        category = expense.get("category", "Other")
        categories[category] = categories.get(category, 0) + float(expense.get("amount", 0))
        date_str = expense.get("date", "")
        if date_str:
            month_key = date_str[:7]
            monthly_trend[month_key] = monthly_trend.get(month_key, 0) + float(expense.get("amount", 0))

    recurring_total = sum(
        float(e.get("amount", 0)) for e in expenses if e.get("isRecurring", False)
    )

    return create_response(200, {
        "totalExpenses": total,
        "categoryBreakdown": categories,
        "monthlyTrend": monthly_trend,
        "recurringTotal": recurring_total,
        "expenseCount": len(expenses),
    })


def generate_upload_url(body, user_id):
    expense_id = body.get("expenseId")
    filename = body.get("filename")
    content_type = body.get("contentType", "image/jpeg")

    if not expense_id or not filename:
        return create_response(400, {"error": "expenseId and filename are required"})
    if not BUCKET:
        return create_response(500, {"error": "Storage not configured"})

    key = f"receipts/{user_id}/{expense_id}/{filename}"
    upload_url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=3600,
    )
    return create_response(200, {"uploadUrl": upload_url, "key": key})


def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return create_response(200, {})

    path = event.get("path", "")
    method = event.get("httpMethod", "")

    if path.endswith("/expenses/health") and method == "GET":
        return health_check()

    user_id = extract_user_id(event)
    if not user_id:
        return create_response(401, {"error": "Authentication required"})

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except json.JSONDecodeError:
            return create_response(400, {"error": "Invalid JSON in request body"})

    if path.endswith("/expenses") and method == "GET":
        return list_expenses(user_id)
    if path.endswith("/expenses") and method == "POST":
        return create_expense(body, user_id)
    if path.endswith("/expenses/recurring") and method == "GET":
        return get_recurring_expenses(user_id)
    if path.endswith("/expenses/analytics") and method == "GET":
        return get_expense_analytics(user_id)
    if path.endswith("/upload") and method == "POST":
        return generate_upload_url(body, user_id)
    if "/recurring" in path and method == "POST":
        expense_id = path.rstrip("/").split("/")[-2]
        return toggle_recurring_expense(expense_id, user_id)
    if "/expenses/" in path and method == "GET":
        expense_id = path.rstrip("/").split("/")[-1]
        return get_expense(expense_id, user_id)
    if "/expenses/" in path and method == "PUT":
        expense_id = path.rstrip("/").split("/")[-1]
        return update_expense(expense_id, body, user_id)
    if "/expenses/" in path and method == "DELETE":
        expense_id = path.rstrip("/").split("/")[-1]
        return delete_expense(expense_id, user_id)

    return create_response(404, {"error": f"Endpoint not found: {method} {path}"})
