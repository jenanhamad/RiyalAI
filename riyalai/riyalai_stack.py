from aws_cdk import (
    Stack,
    Duration,
    aws_lambda as _lambda,
    aws_apigateway as apigw,
    aws_dynamodb as ddb,
    aws_s3 as s3,
    aws_s3_notifications as s3n,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_s3_deployment as s3_deployment,
    aws_cognito as cognito,
    RemovalPolicy,
    aws_iam as iam,
    CfnOutput,
)
from constructs import Construct


class RiyalAiStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        powertools_layer = _lambda.LayerVersion.from_layer_version_arn(
            self, "PowertoolsLayer",
            layer_version_arn="arn:aws:lambda:us-east-1:017000801446:layer:AWSLambdaPowertoolsPythonV2:79",
        )

        pillow_layer = _lambda.LayerVersion.from_layer_version_arn(
            self, "PillowLayer",
            layer_version_arn="arn:aws:lambda:us-east-1:770693421928:layer:Klayers-p312-Pillow:2",
        )

        deps_layer = _lambda.LayerVersion(
            self, "DepsLayer",
            code=_lambda.Code.from_asset("functions/layer"),
            compatible_runtimes=[_lambda.Runtime.PYTHON_3_12],
            description="Shared Lambda dependencies",
        )

        user_pool = cognito.UserPool(
            self, "UserPool",
            user_pool_name="riyalai-users",
            sign_in_aliases=cognito.SignInAliases(email=True),
            auto_verify=cognito.AutoVerifiedAttrs(email=True),
            self_sign_up_enabled=True,
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(required=True, mutable=True),
            ),
            removal_policy=RemovalPolicy.DESTROY,
        )

        user_pool_client = cognito.UserPoolClient(
            self, "UserPoolClient",
            user_pool=user_pool,
            auth_flows=cognito.AuthFlow(
                user_password=True,
                user_srp=True,
            ),
            supported_identity_providers=[cognito.UserPoolClientIdentityProvider.COGNITO],
        )

        cognito_authorizer = apigw.CognitoUserPoolsAuthorizer(
            self, "CognitoAuthorizer",
            cognito_user_pools=[user_pool],
            authorizer_name="RiyalAiAuthorizer",
            identity_source="method.request.header.Authorization",
        )

        expenses_table = ddb.Table(
            self, "ExpensesTable",
            partition_key=ddb.Attribute(name="expenseId", type=ddb.AttributeType.STRING),
            billing_mode=ddb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        receipts_bucket = s3.Bucket(
            self, "ReceiptsBucket",
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            cors=[
                s3.CorsRule(
                    allowed_methods=[
                        s3.HttpMethods.GET,
                        s3.HttpMethods.PUT,
                        s3.HttpMethods.POST,
                        s3.HttpMethods.HEAD,
                    ],
                    allowed_origins=["*"],
                    allowed_headers=["*"],
                    exposed_headers=["ETag"],
                    max_age=3000,
                )
            ],
        )

        api_fn = _lambda.Function(
            self, "ApiFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="expense_app.lambda_handler",
            code=_lambda.Code.from_asset("functions"),
            layers=[deps_layer, powertools_layer],
            environment={
                "TABLE_NAME": expenses_table.table_name,
                "BUCKET": receipts_bucket.bucket_name,
            },
            timeout=Duration.seconds(30),
        )
        expenses_table.grant_read_write_data(api_fn)
        receipts_bucket.grant_read_write(api_fn)

        receipt_processor_fn = _lambda.Function(
            self, "ReceiptProcessorFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="processor.handler",
            code=_lambda.Code.from_asset("functions/receipt_processor"),
            layers=[deps_layer, powertools_layer],
            environment={
                "BUCKET": receipts_bucket.bucket_name,
                "TABLE_NAME": expenses_table.table_name,
            },
            timeout=Duration.seconds(300),
        )
        receipts_bucket.grant_read_write(receipt_processor_fn)
        expenses_table.grant_read_write_data(receipt_processor_fn)

        receipt_processor_fn.add_to_role_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["bedrock:InvokeModel"],
            resources=["arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0"],
        ))

        spending_analysis_fn = _lambda.Function(
            self, "SpendingAnalysisFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="spending.handler",
            code=_lambda.Code.from_asset("functions/spending_analysis"),
            layers=[deps_layer, pillow_layer, powertools_layer],
            environment={
                "TABLE_NAME": expenses_table.table_name,
                "BUCKET": receipts_bucket.bucket_name,
            },
            timeout=Duration.seconds(60),
        )
        receipts_bucket.grant_read(spending_analysis_fn)
        expenses_table.grant_read_write_data(spending_analysis_fn)

        spending_analysis_fn.add_to_role_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["bedrock:InvokeModel"],
            resources=["arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0"],
        ))

        receipt_ocr_fn = _lambda.Function(
            self, "ReceiptOCRFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="ocr.handler",
            code=_lambda.Code.from_asset("functions/receipt_ocr"),
            layers=[deps_layer, powertools_layer],
            environment={
                "BUCKET": receipts_bucket.bucket_name,
                "TABLE_NAME": expenses_table.table_name,
                "RECEIPT_PROCESSOR_FUNCTION": "",
                "SPENDING_ANALYSIS_FUNCTION": "",
            },
            timeout=Duration.seconds(300),
        )
        receipts_bucket.grant_read(receipt_ocr_fn)
        expenses_table.grant_read_write_data(receipt_ocr_fn)

        receipt_ocr_fn.add_to_role_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["textract:DetectDocumentText"],
            resources=["*"],
        ))

        api_fn.add_environment("RECEIPT_PROCESSOR_FUNCTION", receipt_processor_fn.function_name)
        api_fn.add_environment("RECEIPT_OCR_FUNCTION", receipt_ocr_fn.function_name)
        api_fn.add_environment("SPENDING_ANALYSIS_FUNCTION", spending_analysis_fn.function_name)
        receipt_processor_fn.grant_invoke(api_fn)
        receipt_ocr_fn.grant_invoke(api_fn)
        spending_analysis_fn.grant_invoke(api_fn)

        receipt_ocr_fn.add_environment("RECEIPT_PROCESSOR_FUNCTION", receipt_processor_fn.function_name)
        receipt_ocr_fn.add_environment("SPENDING_ANALYSIS_FUNCTION", spending_analysis_fn.function_name)
        receipt_processor_fn.grant_invoke(receipt_ocr_fn)
        spending_analysis_fn.grant_invoke(receipt_ocr_fn)

        receipt_image_processor_fn = _lambda.Function(
            self, "ReceiptImageProcessorFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="processor.handler",
            code=_lambda.Code.from_asset("functions/receipt_image_processor"),
            layers=[deps_layer, pillow_layer, powertools_layer],
            environment={
                "BUCKET": receipts_bucket.bucket_name,
                "TABLE_NAME": expenses_table.table_name,
                "SPENDING_ANALYSIS_FUNCTION": spending_analysis_fn.function_name,
            },
            timeout=Duration.seconds(300),
        )
        receipts_bucket.grant_read_write(receipt_image_processor_fn)
        expenses_table.grant_read_write_data(receipt_image_processor_fn)
        spending_analysis_fn.grant_invoke(receipt_image_processor_fn)

        receipt_image_processor_fn.add_to_role_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["rekognition:DetectLabels", "rekognition:DetectText"],
            resources=["*"],
        ))

        receipts_bucket.add_event_notification(
            s3.EventType.OBJECT_CREATED,
            s3n.LambdaDestination(receipt_image_processor_fn),
        )

        cors = apigw.CorsOptions(
            allow_origins=["*"],
            allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allow_headers=["Content-Type", "Authorization", "X-Api-Key"],
            max_age=Duration.seconds(3000),
        )

        api = apigw.LambdaRestApi(
            self, "RiyalAiApi",
            rest_api_name="RiyalAI Expense Service",
            handler=api_fn,
            proxy=False,
            default_cors_preflight_options=cors,
        )

        auth = {
            "authorizer": cognito_authorizer,
            "authorization_type": apigw.AuthorizationType.COGNITO,
        }

        integration = apigw.LambdaIntegration(api_fn)

        expenses = api.root.add_resource("expenses", default_cors_preflight_options=cors)
        expenses.add_method("GET", integration, **auth)
        expenses.add_method("POST", integration, **auth)

        recurring = expenses.add_resource("recurring", default_cors_preflight_options=cors)
        recurring.add_method("GET", integration, **auth)

        analytics = expenses.add_resource("analytics", default_cors_preflight_options=cors)
        analytics.add_method("GET", integration, **auth)

        health = expenses.add_resource("health")
        health.add_method("GET", integration)

        expense = expenses.add_resource("{expenseId}", default_cors_preflight_options=cors)
        expense.add_method("GET", integration, **auth)
        expense.add_method("PUT", integration, **auth)
        expense.add_method("DELETE", integration, **auth)

        expense_recurring = expense.add_resource("recurring", default_cors_preflight_options=cors)
        expense_recurring.add_method("POST", integration, **auth)

        upload_resource = api.root.add_resource("upload", default_cors_preflight_options=cors)
        upload_resource.add_method("POST", integration, **auth)

        frontend_bucket = s3.Bucket(
            self, "FrontendBucket",
            website_index_document="index.html",
            website_error_document="index.html",
            public_read_access=True,
            block_public_access=s3.BlockPublicAccess(
                block_public_acls=False,
                block_public_policy=False,
                ignore_public_acls=False,
                restrict_public_buckets=False,
            ),
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

        frontend_distribution = cloudfront.Distribution(
            self, "FrontendDistribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin(frontend_bucket),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
            ),
            default_root_object="index.html",
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=200,
                    response_page_path="/index.html",
                )
            ],
        )

        api_cache_policy = cloudfront.CachePolicy(
            self, "ApiCachePolicy",
            header_behavior=cloudfront.CacheHeaderBehavior.allow_list(
                "Origin", "Authorization", "Content-Type",
            ),
            query_string_behavior=cloudfront.CacheQueryStringBehavior.all(),
            cookie_behavior=cloudfront.CacheCookieBehavior.none(),
            default_ttl=Duration.seconds(0),
            max_ttl=Duration.seconds(1),
            min_ttl=Duration.seconds(0),
        )

        frontend_distribution.add_behavior(
            path_pattern="/prod/*",
            origin=origins.HttpOrigin(
                domain_name=f"{api.rest_api_id}.execute-api.{self.region}.amazonaws.com",
                origin_path="/prod",
                protocol_policy=cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            ),
            allowed_methods=cloudfront.AllowedMethods.ALLOW_ALL,
            cache_policy=api_cache_policy,
        )

        s3_deployment.BucketDeployment(
            self, "FrontendDeployment",
            sources=[s3_deployment.Source.asset("./frontend/build")],
            destination_bucket=frontend_bucket,
            distribution=frontend_distribution,
            distribution_paths=["/*"],
        )

        CfnOutput(self, "ApiUrl", value=api.url, export_name="RiyalAiApiUrl")
        CfnOutput(self, "UserPoolId", value=user_pool.user_pool_id, export_name="RiyalAiUserPoolId")
        CfnOutput(self, "UserPoolClientId", value=user_pool_client.user_pool_client_id, export_name="RiyalAiUserPoolClientId")
        CfnOutput(self, "FrontendUrl", value=f"https://{frontend_distribution.distribution_domain_name}", export_name="RiyalAiFrontendUrl")
        CfnOutput(self, "ReceiptsBucket", value=receipts_bucket.bucket_name, export_name="RiyalAiReceiptsBucket")
