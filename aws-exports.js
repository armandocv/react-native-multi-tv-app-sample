// aws-exports.js
const awsconfig = {
  aws_project_region: 'us-west-2',
  aws_cognito_identity_pool_id: 'YOUR_IDENTITY_POOL_ID',
  aws_cognito_region: 'us-west-2',
  aws_user_pools_id: 'YOUR_USER_POOL_ID',
  aws_user_pools_web_client_id: 'YOUR_APP_CLIENT_ID',
  API: {
    REST: {
      'gamelift-api': {
        endpoint: 'YOUR_API_GATEWAY_ENDPOINT',
      },
    },
  },
};

export default awsconfig;
