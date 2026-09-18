import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { Contact, AppSettings } from '../../types';
import { pdfStyles } from './SharedStyles';
import { formatDateDE } from '../../utils/formatting';

export interface ContactWithInvoice {
  contact: Contact;
  invoiceNumber: string;
}

interface CertificateDocumentProps {
  contactsWithInvoices?: ContactWithInvoice[];
  contacts?: Contact[];
  settings: AppSettings;
  formData: {
    title: string;
    certificateDate?: string;
    location: string;
    startDate: string;
    endDate: string;
    text: string;
  };
}

export const CertificateDocument: React.FC<CertificateDocumentProps> = ({ 
  contactsWithInvoices, 
  contacts, 
  settings, 
  formData 
}) => {
  const baseUrl = window.location.origin;

  const items: ContactWithInvoice[] = contactsWithInvoices || (contacts || []).map(c => ({
    contact: c,
    invoiceNumber: ''
  }));

  const certDateStr = formData.certificateDate || new Date().toISOString().split('T')[0];
  const certDateFormatted = formatDateDE(certDateStr);

  const getSalutation = (c: Contact) => {
      if (c.gender === 'male') return `Lieber ${c.firstName},`;
      if (c.gender === 'female') return `Liebe ${c.firstName},`;
      return `Hallo ${c.firstName},`;
  };

  const getDateString = () => {
    const start = formatDateDE(formData.startDate);
    if (!formData.endDate || formData.startDate === formData.endDate) {
      return start;
    }
    const end = formatDateDE(formData.endDate);
    return `${start} bis ${end}`;
  };

  const replacePlaceholders = (text: string, invNum: string) => {
    return text
      .replace(/{Titel}/g, formData.title)
      .replace(/{Ort}/g, formData.location)
      .replace(/{Datum}/g, getDateString())
      .replace(/{Bescheinigungsdatum}/g, certDateFormatted)
      .replace(/{Ausstellungsdatum}/g, certDateFormatted)
      .replace(/{Belegnummer}/g, invNum)
      .replace(/{Nummer}/g, invNum);
  };

  return (
    <Document>
      {items.map(({ contact, invoiceNumber }) => (
        <Page key={contact.id} size="A4" style={pdfStyles.page}>
          <View style={pdfStyles.header}>
            <Image src={`${baseUrl}/logo1.png`} style={pdfStyles.logoLeft} />
            <Image src={`${baseUrl}/logo2.png`} style={pdfStyles.logoRight} />
          </View>

          <Text style={pdfStyles.senderLine}>{settings.senderLine}</Text>

          <View style={pdfStyles.addressBlock}>
            <Text style={pdfStyles.recipientName}>{contact.firstName} {contact.lastName}</Text>
            <Text>{contact.address}</Text>
            <Text>{contact.zip} {contact.city}</Text>
          </View>

          <View style={pdfStyles.metaBlock}>
            <Text>www.alpinkader.nrw</Text>
            <Text>Info@alpinkader.nrw</Text>
            <Text style={{ marginTop: 8, color: '#000' }}>Datum: {certDateFormatted}</Text>
            {invoiceNumber ? (
              <Text style={{ marginTop: 4, fontFamily: 'Helvetica-Bold', color: '#000' }}>Beleg-Nr.: {invoiceNumber}</Text>
            ) : null}
          </View>

          <Text style={[pdfStyles.title, { fontSize: 20, marginTop: 20, marginBottom: 6 }]}>
            {invoiceNumber ? `Teilnahmebescheinigung ${invoiceNumber}: ${formData.title}` : `Teilnahmebescheinigung: ${formData.title}`}
          </Text>
          {invoiceNumber ? (
            <Text style={{ fontSize: 10, color: '#475569', marginBottom: 20 }}>Bescheinigungs-Nr.: {invoiceNumber}</Text>
          ) : (
            <View style={{ marginBottom: 20 }} />
          )}

          <Text style={pdfStyles.text}>{getSalutation(contact)}</Text>
          
          <Text style={[pdfStyles.text, { lineHeight: 2 }]}>
              {replacePlaceholders(formData.text, invoiceNumber)}
          </Text>

          <View style={pdfStyles.footer}>
            {settings.footerInfo.map((line, i) => (
              <Text key={i} style={pdfStyles.footerText}>{line}</Text>
            ))}
          </View>
        </Page>
      ))}
    </Document>
  );
};
