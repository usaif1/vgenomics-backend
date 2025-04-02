const express = require("express");
const {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const dotenv = require("dotenv");
const multer = require("multer");
const cors = require("cors");

dotenv.config();
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Configure AWS S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// function to convert public s3 url to s3 uri

function s3UrlToUri(s3Url) {
  try {
    const url = new URL(s3Url);

    // Extract bucket name and object key
    const bucket = url.hostname.split(".")[0]; // First part of the hostname is the bucket name
    const objectKey = url.pathname.substring(1); // Remove leading "/"

    return `s3://${bucket}/${objectKey}`;
  } catch (error) {
    console.error("Invalid S3 URL:", error);
    return null;
  }
}

// Configure Multer instances for different file types
const csvUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv") {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed!"), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const vcfUpload = multer({
  storage: multer.memoryStorage(),
  // fileFilter: (req, file, cb) => {
  //   const allowedTypes = ["application/gzip", "application/x-gzip"];
  //   if (allowedTypes.includes(file.mimetype)) {
  //     cb(null, true);
  //   } else {
  //     cb(new Error("Only GZIP files are allowed!"), false);
  //   }
  // },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Metadata CSV Upload Route
app.post("/upload-metadata", csvUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No CSV file uploaded",
      });
    }

    const fileName = `input/${req.file.originalname}`;
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    await s3Client.send(new PutObjectCommand(params));

    res.status(200).json({
      success: true,
      message: "Metadata CSV uploaded successfully",
      fileUrl: s3UrlToUri(
        `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`
      ),
    });
  } catch (error) {
    console.error("CSV Upload Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to upload CSV file",
    });
  }
});

// VCF GZIP Upload Route
app.post("/upload-vcf", vcfUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No VCF file uploaded",
      });
    }

    const fileName = `input/${req.file.originalname}`;
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    await s3Client.send(new PutObjectCommand(params));

    res.status(200).json({
      success: true,
      message: "VCF file uploaded successfully",
      fileUrl: s3UrlToUri(
        `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`
      ),
    });
  } catch (error) {
    console.error("VCF Upload Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to upload VCF file",
    });
  }
});

// Existing get-metadata route remains the same
app.get("/get-metadata", async (req, res) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
    };

    const command = new ListObjectsV2Command(params);
    const { Contents } = await s3Client.send(command);

    const files =
      Contents?.map((file) => ({
        fileName: file.Key,
        fileUrl: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${file.Key}`,
        lastModified: file.LastModified,
        size: file.Size,
        type: file.Key.startsWith("metadata/") ? "metadata" : "vcf",
      })) || [];

    res.json({
      success: true,
      files,
    });
  } catch (error) {
    console.error("Error fetching files:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve files",
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
