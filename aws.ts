import AWS from 'aws-sdk'
AWS.config.update({region: 'eu-central-1'});
const s3 = new AWS.S3({
  accessKeyId: process.env.s3Id,
  secretAccessKey: process.env.s3Key,
})

export default s3