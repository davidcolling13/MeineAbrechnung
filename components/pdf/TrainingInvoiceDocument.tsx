import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { Contact, AppSettings } from '../../types';
import { pdfStyles } from './SharedStyles';

export interface ContactWithInvoice {
  contact: Contact;
  invoiceNumber: string;
}

interface TrainingInvoiceDocumentProps {
  contactsWithInvoices?: ContactWithInvoice[];
  contacts?: Contact[];
  settings: AppSettings;
  formData: {
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    fee: number;
    text: string;
  };
}

export const TrainingInvoiceDocument: React.FC<TrainingInvoiceDocumentProps> = ({ 
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

  const getPaymentDeadline = (dateStr: string) => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + 14); 
    return date.toLocaleDateString('de-DE');
  };

  const getSalutation = (c: Contact) => {
      if (c.gender === 'male') return `Lieber ${c.firstName},`;
      if (c.gender === 'female') return `Liebe ${c.firstName},`;
      return `Hallo ${c.firstName},`;
  };

  const getDateString = () => {
    const start = new Date(formData.startDate).toLocaleDateString('de-DE');
    if (!formData.endDate || formData.startDate === formData.endDate) {
      return start;
    }
    const end = new Date(formData.endDate).toLocaleDateString('de-DE');
    return `${start} bis ${end}`;
  };

  const replacePlaceholders = (text: string, invNum: string) => {
    return text
      .replace(/{Titel}/g, formData.title)
      .replace(/{Ort}/g, formData.location)
      .replace(/{Datum}/g, getDateString())
      .replace(/{Gebühr}/g, formData.fee.toFixed(2))
      .replace(/{Frist}/g, getPaymentDeadline(formData.startDate))
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
            <Text style={{ marginTop: 8, color: '#000' }}>Datum: {new Date().toLocaleDateString('de-DE')}</Text>
            {invoiceNumber ? (
              <Text style={{ marginTop: 4, fontFamily: 'Helvetica-Bold', color: '#000' }}>Beleg-Nr.: {invoiceNumber}</Text>
            ) : null}
          </View>

          <Text style={pdfStyles.title}>Rechnung Lehrgang: {formData.title}</Text>

          <Text style={pdfStyles.text}>{getSalutation(contact)}</Text>
          
          <Text style={pdfStyles.text}>
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
