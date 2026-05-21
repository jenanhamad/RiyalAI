import aws_cdk as cdk
from aws_cdk.assertions import Template
from riyalai.riyalai_stack import RiyalAiStack


def test_creates_expenses_table():
    app = cdk.App()
    stack = RiyalAiStack(app, "TestStack")
    template = Template.from_stack(stack)

    template.has_resource_properties(
        "AWS::DynamoDB::Table",
        {"BillingMode": "PAY_PER_REQUEST"},
    )


def test_creates_cognito_user_pool():
    app = cdk.App()
    stack = RiyalAiStack(app, "TestStack")
    template = Template.from_stack(stack)

    template.resource_count_is("AWS::Cognito::UserPool", 1)


def test_creates_api_lambda():
    app = cdk.App()
    stack = RiyalAiStack(app, "TestStack")
    template = Template.from_stack(stack)

    template.has_resource_properties(
        "AWS::Lambda::Function",
        {"Handler": "expense_app.lambda_handler", "Runtime": "python3.12"},
    )
