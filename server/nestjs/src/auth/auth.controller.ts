import { Controller, Post, Body, UseGuards, HttpCode } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsEmail, IsString, MinLength } from "class-validator";
import { AuthService } from "./auth.service";
import { Public } from "../common/decorators/public.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";

class AuthDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

class RefreshDto {
  @IsString()
  refreshToken: string;
}

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post("register")
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  register(@Body() body: AuthDto) {
    return this.auth.register(body.email, body.password);
  }

  @Public()
  @Post("login")
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  login(@Body() body: AuthDto) {
    return this.auth.login(body.email, body.password);
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  refresh(@Body() body: RefreshDto) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post("logout")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: JwtUser) {
    return this.auth.logout(user.sub);
  }
}
