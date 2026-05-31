import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET_MAP: Record<string, string | undefined> = {};

@Injectable()
export class StorageService {
  private s3: S3Client;
  private region: string;
  private buckets: Record<"profiles" | "posts" | "stories", string>;

  constructor(private config: ConfigService) {
    this.region = config.get<string>("AWS_REGION") || "us-east-1";
    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: config.get<string>("AWS_ACCESS_KEY_ID") || "",
        secretAccessKey: config.get<string>("AWS_SECRET_ACCESS_KEY") || "",
      },
    });
    this.buckets = {
      profiles: config.get<string>("S3_BUCKET_PROFILES") || "hubble-profiles",
      posts: config.get<string>("S3_BUCKET_POSTS") || "hubble-posts",
      stories: config.get<string>("S3_BUCKET_STORIES") || "hubble-stories",
    };
  }

  async getPresignedUploadUrl(
    bucket: "profiles" | "posts" | "stories",
    key: string,
    contentType: string,
    expiresIn = 300
  ): Promise<{ url: string; publicUrl: string }> {
    const bucketName = this.buckets[bucket];
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.s3, command, { expiresIn });
    const publicUrl = `https://${bucketName}.s3.${this.region}.amazonaws.com/${key}`;
    return { url, publicUrl };
  }

  getPublicUrl(bucket: "profiles" | "posts" | "stories", key: string): string {
    return `https://${this.buckets[bucket]}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
