import AWS from 'aws-sdk'
AWS.config.update({ region: 'us-west-1' });
const s3 = new AWS.S3({
  accessKeyId: process.env.S3_ID,
  secretAccessKey: process.env.S3_KEY,
})

export default s3