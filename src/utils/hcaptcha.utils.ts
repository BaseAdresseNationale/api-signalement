import { HttpException, HttpStatus } from '@nestjs/common';

export async function checkHCaptcha(captchaToken) {
  const response = await fetch(`https://api.hcaptcha.com/siteverify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `response=${captchaToken}&secret=${process.env.HCAPTCHA_SECRET_KEY}`,
  });

  const json = await response.json();

  if (!json.success) {
    throw new HttpException('Invalid captcha token', HttpStatus.UNAUTHORIZED);
  }

  return json.success;
}
