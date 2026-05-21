"""Weekly challenge generator — runs every Sunday via EventBridge."""
import json
import os

import boto3

from gamification import build_expense_summary_for_ai, create_challenges_for_user, get_or_create_profile
from openrouter import generate_weekly_challenges


def _active_user_ids():
    """Users with expenses in last 30 days (from expenses table)."""
    from boto3.dynamodb.conditions import Attr
    from datetime import date, timedelta

    expenses_table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])
    cutoff = (date.today() - timedelta(days=30)).isoformat()
    user_ids = set()
    resp = expenses_table.scan()
    for item in resp.get("Items", []):
        if (item.get("date", "")[:10] >= cutoff) and item.get("userId"):
            user_ids.add(item["userId"])
    return list(user_ids)


def handler(event, context):
    """Generate AI challenges for all users with recent activity."""
    user_ids = _active_user_ids()
    results = {"processed": 0, "errors": []}

    for user_id in user_ids:
        try:
            get_or_create_profile(user_id)
            summary = build_expense_summary_for_ai(user_id)
            if "لا توجد مصروفات" in summary:
                continue
            ai_result = generate_weekly_challenges(summary)
            challenges = ai_result.get("challenges", [])
            if challenges:
                create_challenges_for_user(user_id, challenges)
                results["processed"] += 1
        except Exception as e:
            results["errors"].append({"userId": user_id, "error": str(e)})

    return {"statusCode": 200, "body": json.dumps(results)}
