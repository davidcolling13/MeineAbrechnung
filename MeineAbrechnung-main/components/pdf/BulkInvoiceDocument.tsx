import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { GeneratedInvoiceData } from '../../services/excelParser';
import { AppSettings } from '../../types';
import { pdfStyles } from './SharedStyles';
import { BULK_ORDER_PAYMENT_TEXT } from '../../constants';

interface BulkInvoiceDocumentProps {
  invoice: GeneratedInvoiceData;
  settings: AppSettings;
}

export const BulkInvoiceDocument: React.FC<BulkInvoiceDocumentProps> = ({ invoice, settings }) => {
  const baseUrl = window.location.origin;

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        {/* Header with Logos */}
        <View style={pdfStyles.header}>
          <Image src={`${baseUrl}/logo1.png`} style={pdfStyles.logoLeft} />
          <Image src={`${baseUrl}/logo2.png`} style={pdfStyles.logoRight} />
        </View>

        {/* Sender Line */}
        <Text style={pdfStyles.senderLine}>{settings.senderLine}</Text>

        {/* Recipient Address */}
        <View style={pdfStyles.addressBlock}>
          <Text style={pdfStyles.recipientName}>{invoice.contact.firstName} {invoice.contact.lastName}</Text>
          <Text>{invoice.contact.address}</Text>
          <Text>{invoice.contact.zip} {invoice.contact.city}</Text>
        </View>

        {/* Meta Info (Right side) */}
        <View style={pdfStyles.metaBlock}>
          <Text>www.alpinkader.nrw</Text>
          <Text>Info@alpinkader.nrw</Text>
          <Text style={{ marginTop: 10, color: '#000' }}>{invoice.date}</Text>
        </View>

        {/* Title */}
        <Text style={pdfStyles.title}>Rechnung {invoice.invoiceNumber}</Text>
        <Text style={{ fontSize: 10, marginBottom: 15 }}>Ausrüstungsbestellung für den DAV Alpinkader NRW:</Text>

        {/* Table */}
        <View style={pdfStyles.table}>
          {/* Header */}
          <View style={[pdfStyles.tableRow, pdfStyles.tableHeader]}>
            <Text style={[pdfStyles.tableCell, { width: '15%' }]}>Art-Nr.</Text>
            <Text style={[pdfStyles.tableCell, { width: '35%' }]}>Artikel</Text>
            <Text style={[pdfStyles.tableCell, { width: '10%' }]}>Größe</Text>
            <Text style={[pdfStyles.tableCell, { width: '10%' }]}>Farbe</Text>
            <Text style={[pdfStyles.tableCell, { width: '10%', textAlign: 'right' }]}>Menge</Text>
            <Text style={[pdfStyles.tableCell, { width: '10%', textAlign: 'right' }]}>Einzel</Text>
            <Text style={[pdfStyles.tableCell, pdfStyles.tableCellLast, { width: '10%', textAlign: 'right' }]}>Gesamt</Text>
          </View>

          {/* Items */}
          {invoice.items.map((item, i) => (
            <View key={i} style={pdfStyles.tableRow}>
              <Text style={[pdfStyles.tableCell, { width: '15%' }]}>{item.articleNo}</Text>
              <Text style={[pdfStyles.tableCell, { width: '35%' }]}>{item.name}</Text>
              <Text style={[pdfStyles.tableCell, { width: '10%' }]}>{item.size}</Text>
              <Text style={[pdfStyles.tableCell, { width: '10%' }]}>{item.color}</Text>
              <Text style={[pdfStyles.tableCell, { width: '10%', textAlign: 'right' }]}>{item.quantity}</Text>
              <Text style={[pdfStyles.tableCell, { width: '10%', textAlign: 'right' }]}>{item.singlePrice.toFixed(2)}</Text>
              <Text style={[pdfStyles.tableCell, pdfStyles.tableCellLast, { width: '10%', textAlign: 'right' }]}>{item.totalPrice.toFixed(2)}</Text>
            </View>
          ))}

          {/* Shipping */}
          <View style={pdfStyles.tableRow}>
            <Text style={[pdfStyles.tableCell, { width: '80%' }]}>Versand / Porto</Text>
            <Text style={[pdfStyles.tableCell, { width: '10%' }]}></Text>
            <Text style={[pdfStyles.tableCell, pdfStyles.tableCellLast, { width: '10%', textAlign: 'right' }]}>{invoice.shippingCost.toFixed(2)}</Text>
          </View>

          {/* Total */}
          <View style={[pdfStyles.tableRow, { borderBottomWidth: 0 }]}>
            <Text style={[pdfStyles.tableCell, { width: '80%', fontFamily: 'Helvetica-Bold' }]}>GESAMTBETRAG</Text>
            <Text style={[pdfStyles.tableCell, { width: '10%' }]}></Text>
            <Text style={[pdfStyles.tableCell, pdfStyles.tableCellLast, { width: '10%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{invoice.total.toFixed(2)} €</Text>
          </View>
        </View>

        {/* Payment Info */}
        <Text style={[pdfStyles.text, { marginTop: 20 }]}>{settings.bankDetails || BULK_ORDER_PAYMENT_TEXT}</Text>

        {/* Footer */}
        <View style={pdfStyles.footer}>
          {(settings.footerInfo || []).map((line, i) => (
            <Text key={i} style={pdfStyles.footerText}>{line}</Text>
          ))}
        </View>
      </Page>
    </Document>
  );
};