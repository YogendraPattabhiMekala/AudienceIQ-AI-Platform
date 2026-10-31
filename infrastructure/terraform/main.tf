terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type    = string
  default = "prod"
}

resource "aws_iam_role" "lambda" {
  name = "audienceiq-${var.environment}-lambda"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/audienceiq-${var.environment}"
  retention_in_days = 30
}

resource "aws_lambda_function" "api" {
  function_name = "audienceiq-${var.environment}-api"
  role          = aws_iam_role.lambda.arn
  handler       = "app.lambda_handler.handler"
  runtime       = "python3.12"
  filename      = "${path.module}/placeholder.zip"
  timeout       = 30
  memory_size   = 512

  environment {
    variables = {
      DEMO_MODE           = "false"
      WAREHOUSE_ADAPTER   = "snowflake"
      SNOWFLAKE_SECRET_ARN = aws_secretsmanager_secret.snowflake.arn
    }
  }

  depends_on = [aws_cloudwatch_log_group.api]
}

resource "aws_apigatewayv2_api" "http" {
  name          = "audienceiq-${var.environment}"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

resource "aws_secretsmanager_secret" "snowflake" {
  name = "audienceiq/${var.environment}/snowflake"
}

output "api_endpoint" {
  value = aws_apigatewayv2_api.http.api_endpoint
}
