#!/usr/bin/env bash

HC='\033[0;35m' # Highlight color
NC='\033[0m' # No Color

TEMPLATE_FILE=template.yaml
REGION=us-east-1
S3_BUCKET=lambda-functions-artifacts-store
AWS_PROFILE=default

echo -e "Using environment: ${HC}${ENV}${NC}"
echo -e "Using template file: ${HC}${TEMPLATE_FILE}${NC}"

echo -e "\n${HC}Creating bundle${NC}"
sam build --template $TEMPLATE_FILE

echo -e "\n${HC}Deploying to AWS${NC}"
sam deploy \
  --stack-name lambda-GeneratePdfEmbeddings \
  --region $REGION \
  --s3-bucket $S3_BUCKET \
  --s3-prefix generate-pdf-embeddings	\
  --profile $AWS_PROFILE \
  --capabilities CAPABILITY_IAM
