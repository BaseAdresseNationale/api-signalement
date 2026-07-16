import { ApiProperty } from '@nestjs/swagger';

export class Author {
  @ApiProperty({ required: false, nullable: true })
  firstName?: string;

  @ApiProperty({ required: false, nullable: true })
  lastName?: string;

  @ApiProperty({ required: false, nullable: true })
  email?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      "Domaine de l'email conservé après anonymisation à des fins statistiques",
  })
  emailDomain?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      "Date à laquelle les données personnelles de l'auteur ont été anonymisées",
  })
  anonymizedAt?: Date;
}
