pipeline {
    agent any
    
    environment {
        // Conjur configuration
        CONJUR_URL = 'https://proxy:8443'
        CONJUR_ACCOUNT = 'myConjurAccount'
        CONJUR_LOGIN = 'host/jenkins-hosts/debian-1'
        
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
        
stage('Authenticate to Conjur via REST API') {
    steps {
        script {
            echo 'Authenticating to Conjur using REST API...'
            withCredentials([string(credentialsId: 'conjur-api-key', variable: 'API_KEY')]) {
                def encodedLogin = CONJUR_LOGIN.replace('/', '%2F')
                
                // Get just the token, no status code mixed in
                def token = sh(
                    script: """
                        curl -k -X POST \
                          '${CONJUR_URL}/authn/${CONJUR_ACCOUNT}/${encodedLogin}/authenticate' \
                          -H 'Content-Type: text/plain' \
                          --data "\${API_KEY}" \
                          -s
                    """,
                    returnStdout: true
                ).trim()
                
                // Check if we got a token (should be a long base64-like string)
                if (token.isEmpty() || token.contains('error') || token.contains('Malformed')) {
                    error("Authentication failed. Response: ${token}")
                }
                
                env.CONJUR_TOKEN = token
                echo "✓ Successfully authenticated to Conjur"
                echo "Token length: ${token.length()}"  // Should be ~500+ characters
            }
        }
    }
}
        
stage('Retrieve AWS Credentials via REST API') {
    steps {
        script {
            echo 'Retrieving AWS credentials from Conjur...'
            
            // Test the token first
            def testResponse = sh(
                script: """
                    curl -k -X GET \
                      '${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${AWS_ACCESS_KEY_PATH}' \
                      -H "Authorization: Token token=\${CONJUR_TOKEN}" \
                      -w '\\nHTTP_CODE:%{http_code}' \
                      -s
                """,
                returnStdout: true
            ).trim()
            
            echo "Test response: ${testResponse}"
            
            // Check for errors
            if (testResponse.contains('Malformed') || testResponse.contains('error')) {
                error("Token is invalid or malformed: ${testResponse}")
            }
            
            // If test passed, retrieve all secrets
            env.AWS_ACCESS_KEY_ID = sh(
                script: """
                    curl -k -X GET \
                      '${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${AWS_ACCESS_KEY_PATH}' \
                      -H "Authorization: Token token=\${CONJUR_TOKEN}" \
                      -s
                """,
                returnStdout: true
            ).trim()
            
            env.AWS_SECRET_ACCESS_KEY = sh(
                script: """
                    curl -k -X GET \
                      '${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${AWS_SECRET_KEY_PATH}' \
                      -H "Authorization: Token token=\${CONJUR_TOKEN}" \
                      -s
                """,
                returnStdout: true
            ).trim()
            
            env.S3_BUCKET = sh(
                script: """
                    curl -k -X GET \
                      '${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${BUCKET_NAME_PATH}' \
                      -H "Authorization: Token token=\${CONJUR_TOKEN}" \
                      -s
                """,
                returnStdout: true
            ).trim()
            
            env.AWS_REGION = sh(
                script: """
                    curl -k -X GET \
                      '${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${REGION_PATH}' \
                      -H "Authorization: Token token=\${CONJUR_TOKEN}" \
                      -s
                """,
                returnStdout: true
            ).trim()
            
            // Verify we got actual values
            if (env.AWS_ACCESS_KEY_ID.contains('Malformed') || env.AWS_ACCESS_KEY_ID.length() < 10) {
                error("Failed to retrieve AWS credentials")
            }
            
            echo '✓ Successfully retrieved all secrets'
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
                        
                        aws sts get-caller-identity
                        aws s3 ls s3://${S3_BUCKET}
                    '''
                    echo '✓ AWS connection verified'
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
                        
                        aws s3 sync . s3://${S3_BUCKET}/ \
                            --exclude ".git/*" \
                            --exclude "Jenkinsfile" \
                            --exclude "README.md" \
                            --delete
                        
                        echo "Website URL: http://${S3_BUCKET}.s3-website-${AWS_REGION}.amazonaws.com"
                    '''
                    echo '✓ Deployment complete'
                }
            }
        }
    }
    
    post {
        always {
            script {
                echo 'Cleaning up sensitive data...'
                env.CONJUR_TOKEN = ''
                env.AWS_ACCESS_KEY_ID = ''
                env.AWS_SECRET_ACCESS_KEY = ''
                env.S3_BUCKET = ''
                env.AWS_REGION = ''
            }
        }
        success {
            echo '🎉 Deployment succeeded!'
        }
        failure {
            echo '❌ Deployment failed'
        }
    }
}
