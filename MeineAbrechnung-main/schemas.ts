import { z } from 'zod';

export const ContactSchema = z.object({
  firstName: z.string().min(1, "Vorname ist erforderlich"),
  lastName: z.string().min(1, "Nachname ist erforderlich"),
  address: z.string().min(1, "Adresse ist erforderlich"),
  zip: z.string().min(3, "PLZ muss mindestens 3 Zeichen haben"),
  city: z.string().min(1, "Stadt ist erforderlich"),
  email: z.string().email("Ungültige E-Mail-Adresse").or(z.literal('')),
  type: z.enum(['Athlet', 'Trainer'] as const),
  gender: z.enum(['male', 'female', 'other'] as const).default('other')
});

export type ContactFormData = z.infer<typeof ContactSchema>;