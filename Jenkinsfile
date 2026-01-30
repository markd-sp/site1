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
            
            // Write a shell script to handle the curl commands
            sh """
                # Function to retrieve secret
                get_secret() {
                    local secret_path=\$1
                    curl -k -X GET \
                      "${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/\${secret_path}" \
                      -H "Authorization: Token token=${CONJUR_TOKEN}" \
                      -s
                }
                
                # Retrieve all secrets and save to files
                get_secret "${AWS_ACCESS_KEY_PATH}" > /tmp/aws_access_key.txt
                get_secret "${AWS_SECRET_KEY_PATH}" > /tmp/aws_secret_key.txt
                get_secret "${BUCKET_NAME_PATH}" > /tmp/s3_bucket.txt
                get_secret "${REGION_PATH}" > /tmp/aws_region.txt
            """
            
            // Read the values from files
            env.AWS_ACCESS_KEY_ID = sh(script: 'cat /tmp/aws_access_key.txt', returnStdout: true).trim()
            env.AWS_SECRET_ACCESS_KEY = sh(script: 'cat /tmp/aws_secret_key.txt', returnStdout: true).trim()
            env.S3_BUCKET = sh(script: 'cat /tmp/s3_bucket.txt', returnStdout: true).trim()
            env.AWS_REGION = sh(script: 'cat /tmp/aws_region.txt', returnStdout: true).trim()
            
            // Clean up temp files
            sh 'rm -f /tmp/aws_access_key.txt /tmp/aws_secret_key.txt /tmp/s3_bucket.txt /tmp/aws_region.txt'
            
            // Verify we got values
            if (env.AWS_ACCESS_KEY_ID.contains('error') || env.AWS_ACCESS_KEY_ID.length() < 10) {
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
