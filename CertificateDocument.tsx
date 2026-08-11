import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { Contact, AppSettings } from '../../types';
import { pdfStyles } from './SharedStyles';

interface CertificateDocumentProps {
  contacts: Contact[];
  settings: AppSettings;
  formData: {
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    text: string;
  };
}

export const CertificateDocument: React.FC<CertificateDocumentProps> = ({ contacts, settings, formData }) => {
  const baseUrl = window.location.origin;

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

  const replacePlaceholders = (text: string) => {
    return text
      .replace(/{Titel}/g, formData.title)
      .replace(/{Ort}/g, formData.location)
      .replace(/{Datum}/g, getDateString());
  };

  return (
    <Document>
      {contacts.map((contact) => (
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
            <Text style={{ marginTop: 10, color: '#000' }}>{new Date().toLocaleDateString('de-DE')}</Text>
          </View>

          <Text style={[pdfStyles.title, { fontSize: 24, marginTop: 20, marginBottom: 30 }]}>Teilnahmebescheinigung</Text>

          <Text style={pdfStyles.text}>{getSalutation(contact)}</Text>
          
          <Text style={[pdfStyles.text, { lineHeight: 2 }]}>
              {replacePlaceholders(formData.text)}
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