pipeline {
    agent any
    
    environment {
        // Conjur configuration
        CONJUR_URL = 'http://192.168.216.130:8080'  // REPLACE with your Conjur URL
        CONJUR_ACCOUNT = 'myConjurAccount'                    // REPLACE with your account
        CONJUR_LOGIN = 'host/debian-1'          // REPLACE with your host login
        
        // Secret paths in Conjur
        AWS_ACCESS_KEY_PATH = 'jenkins-app/aws/access-key-id'
        AWS_SECRET_KEY_PATH = 'jenkins-app/aws/secret-access-key'
        BUCKET_NAME_PATH = 'jenkins-app/aws/bucket-name'
        REGION_PATH = 'jenkins-app/aws/region'
    }
    
    stages {
        stage('Checkout Code') {
            steps {
                echo 'Checking out code from Git...'
                checkout scm
            }
        }
        
//       stage('Authenticate to Conjur') {
//           steps {
//               script {
//                   echo 'Authenticating to Conjur...'
//                   withCredentials([conjurSecretCredential(credentialsId: 'f2df6edf-0d3a-4c8a-9a7c-752404ffedbd', variable: 'api_key')]) {
//                       def authResponse = httpRequest(
//                           url: "${CONJUR_URL}/authn/${CONJUR_ACCOUNT}/${CONJUR_LOGIN}/authenticate",
//                           httpMode: 'POST',
//                           contentType: 'TEXT_PLAIN',
//                           requestBody: API_KEY,
//                           validResponseCodes: '200'
//                       )
//                       env.CONJUR_TOKEN = authResponse.content
//                       echo 'Successfully authenticated to Conjur ✓'
//                   }
//               }
//           }
//       }
        
        stage('Retrieve AWS Credentials from Conjur') {
            steps {
                script {
                    echo 'Retrieving AWS credentials from Conjur...'
                    
                    // Get AWS Access Key ID
                    def akResponse = httpRequest(
                        url: "${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${AWS_ACCESS_KEY_PATH}",
                        httpMode: 'GET',
                        customHeaders: [[
                            name: 'Authorization',
                            value: "Token token=\"${env.CONJUR_TOKEN}\""
                        ]],
                        validResponseCodes: '200'
                    )
                    env.AWS_ACCESS_KEY_ID = akResponse.content.trim()
                    
                    // Get AWS Secret Access Key
                    def skResponse = httpRequest(
                        url: "${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${AWS_SECRET_KEY_PATH}",
                        httpMode: 'GET',
                        customHeaders: [[
                            name: 'Authorization',
                            value: "Token token=\"${env.CONJUR_TOKEN}\""
                        ]],
                        validResponseCodes: '200'
                    )
                    env.AWS_SECRET_ACCESS_KEY = skResponse.content.trim()
                    
                    // Get S3 Bucket Name
                    def bucketResponse = httpRequest(
                        url: "${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${BUCKET_NAME_PATH}",
                        httpMode: 'GET',
                        customHeaders: [[
                            name: 'Authorization',
                            value: "Token token=\"${env.CONJUR_TOKEN}\""
                        ]],
                        validResponseCodes: '200'
                    )
                    env.S3_BUCKET = bucketResponse.content.trim()
                    
                    // Get AWS Region
                    def regionResponse = httpRequest(
                        url: "${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${REGION_PATH}",
                        httpMode: 'GET',
                        customHeaders: [[
                            name: 'Authorization',
                            value: "Token token=\"${env.CONJUR_TOKEN}\""
                        ]],
                        validResponseCodes: '200'
                    )
                    env.AWS_REGION = regionResponse.content.trim()
                    
                    echo 'Successfully retrieved all AWS credentials ✓'
                }
            }
        }
        
        stage('Verify AWS Connection') {
            steps {
                script {
                    echo 'Testing AWS connection...'
                    sh '''
                        export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}"
                        export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}"
                        export AWS_DEFAULT_REGION="${AWS_REGION}"
                        
                        # Verify credentials work
                        aws sts get-caller-identity
                        
                        # Verify bucket exists
                        aws s3 ls s3://${S3_BUCKET}
                    '''
                    echo 'AWS connection verified ✓'
                }
            }
        }
        
        stage('Deploy to S3') {
            steps {
                script {
                    echo 'Deploying website to S3...'
                    sh '''
                        export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}"
                        export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}"
                        export AWS_DEFAULT_REGION="${AWS_REGION}"
                        
                        # Sync website files to S3
                        aws s3 sync . s3://${S3_BUCKET}/ \
                            --exclude ".git/*" \
                            --exclude "Jenkinsfile" \
                            --exclude "README.md" \
                            --delete \
                            --cache-control "max-age=3600"
                        
                        echo "Deployment complete!"
                        echo "Website URL: http://${S3_BUCKET}.s3-website-${AWS_REGION}.amazonaws.com"
                    '''
                    echo 'Successfully deployed to S3 ✓'
                }
            }
        }
    }
    
    post {
        always {
            script {
                echo 'Cleaning up sensitive data...'
                // Clear all sensitive environment variables
                env.CONJUR_TOKEN = ''
                env.AWS_ACCESS_KEY_ID = ''
                env.AWS_SECRET_ACCESS_KEY = ''
                env.S3_BUCKET = ''
                env.AWS_REGION = ''
                echo 'Cleanup complete ✓'
            }
        }
        success {
            echo '🎉 Deployment succeeded!'
            echo 'Visit your website at the URL shown above.'
        }
        failure {
            echo '❌ Deployment failed. Check the console output for errors.'
        }
    }
}
