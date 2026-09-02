import { z } from 'zod';

import { lengthMessages, VALIDATION_RULES } from './rules';
import { optionalText, optionalUuid } from './shared';

const rules = VALIDATION_RULES.article;
const titleMessages = lengthMessages('El titulo', rules.title.minLength, rules.title.maxLength);
const contentMessages = lengthMessages('El contenido', rules.content.minLength, rules.content.maxLength);

export const createArticleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(rules.title.minLength, { message: titleMessages.min })
    .max(rules.title.maxLength, { message: titleMessages.max }),

  slug: z
    .string()
    .trim()
    .max(rules.slug.maxLength, { message: `El slug no puede superar los ${rules.slug.maxLength} caracteres.` })
    .optional()
    .or(z.literal('')),

  summary: optionalText(rules.summary.maxLength, 'El resumen'),

  content: z
    .string()
    .trim()
    .min(rules.content.minLength, { message: contentMessages.min })
    .max(rules.content.maxLength, { message: contentMessages.max }),

  categoryId: optionalUuid,

  isPublished: z.boolean().default(true),

  tags: z
    .array(z.string().trim().min(1).max(50))
    .max(10, { message: 'Puedes anadir un maximo de 10 etiquetas.' })
    .default([]),
});

export const updateArticleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(rules.title.minLength, { message: titleMessages.min })
    .max(rules.title.maxLength, { message: titleMessages.max })
    .optional(),

  slug: z
    .string()
    .trim()
    .max(rules.slug.maxLength, { message: `El slug no puede superar los ${rules.slug.maxLength} caracteres.` })
    .optional()
    .or(z.literal('')),

  summary: optionalText(rules.summary.maxLength, 'El resumen'),

  content: z
    .string()
    .trim()
    .min(rules.content.minLength, { message: contentMessages.min })
    .max(rules.content.maxLength, { message: contentMessages.max })
    .optional(),

  categoryId: optionalUuid,

  isPublished: z.boolean().optional(),

  tags: z
    .array(z.string().trim().min(1).max(50))
    .max(10, { message: 'Puedes anadir un maximo de 10 etiquetas.' })
    .optional(),
});

export type CreateArticleFormInput = z.input<typeof createArticleSchema>;
export type CreateArticleFormValues = z.output<typeof createArticleSchema>;
export type UpdateArticleFormValues = z.output<typeof updateArticleSchema>;
