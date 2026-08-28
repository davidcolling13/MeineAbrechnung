import { StyleSheet, Font } from '@react-pdf/renderer';

// Font Registration (using standard fonts for now to avoid loading issues, can be upgraded to custom fonts)
// Helvetica is built-in in PDF standards, so it works reliably.

export const pdfStyles = StyleSheet.create({
  page: {
    padding: 40, // ~15mm
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#000000',
    lineHeight: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    height: 60,
  },
  logoLeft: {
    width: 150,
    objectFit: 'contain',
  },
  logoRight: {
    width: 120,
    objectFit: 'contain',
  },
  senderLine: {
    fontSize: 7,
    textDecoration: 'underline',
    color: '#475569', // slate-600
    marginBottom: 20,
  },
  addressBlock: {
    marginBottom: 40,
    fontSize: 10,
  },
  recipientName: {
    fontFamily: 'Helvetica-Bold',
  },
  metaBlock: {
    position: 'absolute',
    top: 130, // Adjust based on header
    right: 40,
    textAlign: 'right',
    fontSize: 9,
    color: '#475569',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 15,
  },
  text: {
    marginBottom: 10,
    textAlign: 'justify',
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
  },
  // Table Styles
  table: {
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#000',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    minHeight: 18, // Slightly reduced min height
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#f1f5f9', // slate-100
    fontFamily: 'Helvetica-Bold',
  },
  tableCell: {
    padding: 2, // Reduced padding for compactness
    fontSize: 9, // Explicitly 9pt
    borderRightWidth: 1,
    borderRightColor: '#000',
  },
  tableCellLast: {
    borderRightWidth: 0,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 7,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 2,
  },
});