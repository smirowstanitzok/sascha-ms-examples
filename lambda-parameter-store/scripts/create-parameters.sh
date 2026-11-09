# scripts/create-parameters.sh – creates the example parameters for one stage
set -euo pipefail
STAGE="${1:-dev}"
PREFIX="/bike-rental/${STAGE}"

aws ssm put-parameter --name "${PREFIX}/log-level" --type String --value "INFO" --overwrite
aws ssm put-parameter --name "${PREFIX}/price-per-hour-cents" --type String --value "450" --overwrite
aws ssm put-parameter --name "${PREFIX}/rental-paused" --type String --value "false" --overwrite
aws ssm put-parameter --name "${PREFIX}/payment-api-key" --type SecureString --value "test-key-replace-me" --overwrite

echo "Parameters created under ${PREFIX}"
