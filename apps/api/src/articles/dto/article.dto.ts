import type {
  Article,
  ArticleListItem,
  ArticleSummary,
  CategoryRef,
  UserRef,
} from '@conit/types';
import { VALIDATION_RULES } from '@conit/validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import { CategoryRefDto, UserRefDto } from '../../tickets/dto/ticket-response.dto';

const rules = VALIDATION_RULES.article;

/** Recorta cadenas antes de validar, para que "   " no pase por no vacio. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateArticleDto {
  @ApiProperty({ minLength: rules.title.minLength, maxLength: rules.title.maxLength })
  @Transform(trim)
  @IsString()
  @MinLength(rules.title.minLength)
  @MaxLength(rules.title.maxLength)
  title!: string;

  @ApiPropertyOptional({
    maxLength: rules.slug.maxLength,
    description: 'Identificador para la URL. Si se omite, se deriva del titulo.',
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(rules.slug.maxLength)
  slug?: string;

  @ApiPropertyOptional({ maxLength: rules.summary.maxLength, nullable: true })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(rules.summary.maxLength)
  summary?: string | null;

  @ApiProperty({
    minLength: rules.content.minLength,
    maxLength: rules.content.maxLength,
    description: 'Cuerpo del articulo en Markdown.',
  })
  @Transform(trim)
  @IsString()
  @MinLength(rules.content.minLength)
  @MaxLength(rules.content.maxLength)
  content!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string | null;

  @ApiPropertyOptional({ default: true, description: 'Un borrador no aparece en la consulta.' })
  @Transform(({ value }) => (typeof value === 'string' ? value === 'true' : value))
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

/** Todo opcional: la edicion aplica solo lo que llega. */
export class UpdateArticleDto extends CreateArticleDto {
  @ApiPropertyOptional({ minLength: rules.title.minLength, maxLength: rules.title.maxLength })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(rules.title.minLength)
  @MaxLength(rules.title.maxLength)
  declare title: string;

  @ApiPropertyOptional({
    minLength: rules.content.minLength,
    maxLength: rules.content.maxLength,
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(rules.content.minLength)
  @MaxLength(rules.content.maxLength)
  declare content: string;
}

export class ArticleListItemDto implements ArticleListItem {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Como renovar un certificado SSL' })
  title!: string;

  @ApiProperty({ example: 'como-renovar-un-certificado-ssl' })
  slug!: string;

  @ApiPropertyOptional({ nullable: true })
  summary!: string | null;

  @ApiPropertyOptional({ type: CategoryRefDto, nullable: true })
  category!: CategoryRef | null;

  @ApiPropertyOptional({ type: UserRefDto, nullable: true })
  author!: UserRef | null;

  @ApiProperty()
  isPublished!: boolean;

  @ApiProperty({ example: 128 })
  viewsCount!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class ArticleResponseDto extends ArticleListItemDto implements Article {
  @ApiProperty({ description: 'Cuerpo completo en Markdown.' })
  content!: string;
}

export class ArticleSummaryDto implements ArticleSummary {
  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 35 })
  published!: number;

  @ApiProperty({ example: 7 })
  drafts!: number;

  @ApiProperty({ example: 1840 })
  totalViews!: number;
}
