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
                
                // Get authentication response
                def result = sh(
                    script: """
                        curl -k -X POST \
                          '${CONJUR_URL}/authn/${CONJUR_ACCOUNT}/${encodedLogin}/authenticate' \
                          -H 'Content-Type: text/plain' \
                          --data "\${API_KEY}" \
                          -w "\\nHTTPCODE:%{http_code}" \
                          -s
                    """,
                    returnStdout: true
                ).trim()
                
                // Parse response
                def parts = result.split('HTTPCODE:')
                def jsonResponse = parts[0].trim()
                def httpCode = parts[1].trim()
                
                if (httpCode != '200') {
                    error("Authentication failed with HTTP ${httpCode}")
                }
                
                // The token is the entire JSON response
                // Conjur expects the full JSON as the token
                env.CONJUR_TOKEN = jsonResponse
                
                echo "✓ Successfully authenticated (token length: ${jsonResponse.length()})"
            }
        }
    }
}

stage('Retrieve AWS Credentials via REST API') {
    steps {
        script {
            echo 'Retrieving AWS credentials from Conjur...'
            
            // Write token to file to avoid shell escaping issues with JSON
            writeFile file: '/tmp/conjur_token.txt', text: env.CONJUR_TOKEN
            
            sh """
                # Read token from file
                TOKEN=\$(cat /tmp/conjur_token.txt)
                
                echo "Retrieving AWS Access Key..."
                curl -k -X GET \
                  "${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${AWS_ACCESS_KEY_PATH}" \
                  -H "Authorization: Token token=\"\${TOKEN}\"" \
                  -s > /tmp/aws_access_key.txt
                
                echo "Checking response..."
                cat /tmp/aws_access_key.txt
                
                echo ""
                echo "Retrieving AWS Secret Key..."
                curl -k -X GET \
                  "${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${AWS_SECRET_KEY_PATH}" \
                  -H "Authorization: Token token=\"\${TOKEN}\"" \
                  -s > /tmp/aws_secret_key.txt
                
                echo "Retrieving S3 Bucket..."
                curl -k -X GET \
                  "${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${BUCKET_NAME_PATH}" \
                  -H "Authorization: Token token=\"\${TOKEN}\"" \
                  -s > /tmp/s3_bucket.txt
                
                echo "Retrieving AWS Region..."
                curl -k -X GET \
                  "${CONJUR_URL}/secrets/${CONJUR_ACCOUNT}/variable/${REGION_PATH}" \
                  -H "Authorization: Token token=\"\${TOKEN}\"" \
                  -s > /tmp/aws_region.txt
                
                # Clean up token file
                rm -f /tmp/conjur_token.txt
            """
            
            // Read all secrets
            env.AWS_ACCESS_KEY_ID = readFile('/tmp/aws_access_key.txt').trim()
            env.AWS_SECRET_ACCESS_KEY = readFile('/tmp/aws_secret_key.txt').trim()
            env.S3_BUCKET = readFile('/tmp/s3_bucket.txt').trim()
            env.AWS_REGION = readFile('/tmp/aws_region.txt').trim()
            
            // Clean up
            sh 'rm -f /tmp/aws_access_key.txt /tmp/aws_secret_key.txt /tmp/s3_bucket.txt /tmp/aws_region.txt'
            
            // Verify
            if (env.AWS_ACCESS_KEY_ID.contains('Authorization missing') || 
                env.AWS_ACCESS_KEY_ID.contains('error') ||
                env.AWS_ACCESS_KEY_ID.length() < 10) {
                error("Failed to retrieve AWS credentials. Got: ${env.AWS_ACCESS_KEY_ID}")
            }
            
            echo "✓ Successfully retrieved AWS Access Key (length: ${env.AWS_ACCESS_KEY_ID.length()})"
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
