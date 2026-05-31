import { Controller, Post, Body, UseGuards, BadRequestException } from "@nestjs/common";
import { StorageService } from "./storage.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { IsEnum, IsString, Matches } from "class-validator";

class PresignDto {
  @IsEnum(["profiles", "posts", "stories"])
  bucket: "profiles" | "posts" | "stories";

  @IsString()
  @Matches(/^[a-zA-Z0-9_\-/.]+$/, { message: "Invalid key format" })
  key: string;

  @IsString()
  contentType: string;
}

@Controller("storage")
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private storage: StorageService) {}

  @Post("presign")
  async presign(@Body() body: PresignDto) {
    const allowed = [
      "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif",
      "image/bmp", "video/mp4", "video/quicktime", "video/webm", "audio/mpeg", "audio/wav",
      "audio/aac", "audio/flac", "audio/x-m4a", "audio/ogg",
    ];
    if (!allowed.includes(body.contentType)) {
      throw new BadRequestException("Unsupported content type");
    }
    return this.storage.getPresignedUploadUrl(body.bucket, body.key, body.contentType);
  }
}
