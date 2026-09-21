import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { GeneratedInvoiceData } from '../../services/excelParser';
import { AppSettings } from '../../types';
import { pdfStyles } from './SharedStyles';
import { BULK_ORDER_PAYMENT_TEXT } from '../../constants';
import { calculateDueDate } from '../../utils/formatting';

interface BulkInvoiceDocumentProps {
  invoice: GeneratedInvoiceData;
  settings: AppSettings;
}

export const BulkInvoiceDocument: React.FC<BulkInvoiceDocumentProps> = ({ invoice, settings }) => {
  const baseUrl = window.location.origin;
  const dueDateStr = invoice.dueDate || calculateDueDate(invoice.isoDate || invoice.date, 14);

  const paymentText = (settings.bankDetails || BULK_ORDER_PAYMENT_TEXT)
    .replace(/{Frist}/g, dueDateStr)
    .replace(/{Zahlungsziel}/g, dueDateStr)
    .replace(/{Rechnungsdatum}/g, invoice.date)
    .replace(/{Belegnummer}/g, invoice.invoiceNumber)
    .replace(/{Nummer}/g, invoice.invoiceNumber);

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
          <Text style={{ marginTop: 8, color: '#000' }}>Rechnungsdatum: {invoice.date}</Text>
          <Text style={{ marginTop: 2, color: '#1e40af', fontFamily: 'Helvetica-Bold' }}>Zahlungsziel: {dueDateStr}</Text>
        </View>

        {/* Title */}
        <Text style={pdfStyles.title}>Rechnung {invoice.invoiceNumber}: Sammelbestellung</Text>
        <Text style={{ fontSize: 10, marginBottom: 15 }}>Ausrüstungsbestellung für den DAV Alpinkader NRW:</Text>

        {/* Table */}
        <View style={pdfStyles.table}>
          {/* Header */}
          <View style={[pdfStyles.tableRow, pdfStyles.tableHeader]}>
            <View style={[pdfStyles.tableCell, { width: '17%' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>Art-Nr.</Text>
            </View>
            <View style={[pdfStyles.tableCell, { width: '28%' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>Artikel</Text>
            </View>
            <View style={[pdfStyles.tableCell, { width: '7%' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', textAlign: 'center' }}>Größe</Text>
            </View>
            <View style={[pdfStyles.tableCell, { width: '18%' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>Farbe</Text>
            </View>
            <View style={[pdfStyles.tableCell, { width: '6%' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', textAlign: 'center' }}>Menge</Text>
            </View>
            <View style={[pdfStyles.tableCell, { width: '12%' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>Einzel</Text>
            </View>
            <View style={[pdfStyles.tableCell, pdfStyles.tableCellLast, { width: '12%' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>Gesamt</Text>
            </View>
          </View>

          {/* Items */}
          {invoice.items.map((item, i) => (
            <View key={i} style={pdfStyles.tableRow}>
              <View style={[pdfStyles.tableCell, { width: '17%' }]}>
                <Text>{item.articleNo}</Text>
              </View>
              <View style={[pdfStyles.tableCell, { width: '28%' }]}>
                <Text>{item.name}</Text>
              </View>
              <View style={[pdfStyles.tableCell, { width: '7%' }]}>
                <Text style={{ textAlign: 'center' }}>{item.size}</Text>
              </View>
              <View style={[pdfStyles.tableCell, { width: '18%' }]}>
                <Text>{item.color}</Text>
              </View>
              <View style={[pdfStyles.tableCell, { width: '6%' }]}>
                <Text style={{ textAlign: 'center' }}>{item.quantity}</Text>
              </View>
              <View style={[pdfStyles.tableCell, { width: '12%' }]}>
                <Text style={{ textAlign: 'right' }}>{item.singlePrice.toFixed(2)} €</Text>
              </View>
              <View style={[pdfStyles.tableCell, pdfStyles.tableCellLast, { width: '12%' }]}>
                <Text style={{ textAlign: 'right' }}>{item.totalPrice.toFixed(2)} €</Text>
              </View>
            </View>
          ))}

          {/* Shipping */}
          <View style={pdfStyles.tableRow}>
            <View style={[pdfStyles.tableCell, { width: '88%' }]}>
              <Text>Versand / Porto</Text>
            </View>
            <View style={[pdfStyles.tableCell, pdfStyles.tableCellLast, { width: '12%' }]}>
              <Text style={{ textAlign: 'right' }}>{invoice.shippingCost.toFixed(2)} €</Text>
            </View>
          </View>

          {/* Total */}
          <View style={[pdfStyles.tableRow, { borderBottomWidth: 0 }]}>
            <View style={[pdfStyles.tableCell, { width: '88%' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>GESAMTBETRAG</Text>
            </View>
            <View style={[pdfStyles.tableCell, pdfStyles.tableCellLast, { width: '12%' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>{invoice.total.toFixed(2)} €</Text>
            </View>
          </View>
        </View>

        {/* Payment Info */}
        <Text style={[pdfStyles.text, { marginTop: 20 }]}>{paymentText}</Text>

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