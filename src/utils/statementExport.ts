import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Document, 
  Packer, 
  Paragraph, 
  Table, 
  TableCell, 
  TableRow, 
  TextRun, 
  HeadingLevel, 
  AlignmentType, 
  BorderStyle, 
  WidthType, 
  ShadingType 
} from 'docx';
import type { Transaction, UserProfile } from '../types/index.ts';

export interface ExportStatementOptions {
  user: UserProfile;
  transactions: Transaction[];
  startDate?: string;
  endDate?: string;
  reportTitle?: string;
}

/**
 * Format number into Indian numbering style without symbol (e.g. 1,50,000.00)
 */
export function formatINRNumber(val: number): string {
  const num = Number(val) || 0;
  return Math.abs(num).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Generate and download an official PDF Statement using jsPDF + autoTable
 */
export async function exportTransactionsToPdf(options: ExportStatementOptions): Promise<void> {
  const { user, transactions, startDate, endDate, reportTitle = 'TRANSACTION STATEMENT' } = options;

  // Calculate totals
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netSavings = totalIncome - totalExpense;

  // Initialize jsPDF (Portrait, mm, A4)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // --- Header Brand Banner ---
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('EXPENSE ANALYZER', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // Slate-300
  doc.text('Personal Finance & Spending Pattern Analyzer', margin, 18);
  doc.text('Official Account Transaction Statement', margin, 23);

  // Document Title & Generation Timestamp on Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(reportTitle.toUpperCase(), pageWidth - margin, 12, { align: 'right' });

  const generatedDateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Generated: ${generatedDateStr}`, pageWidth - margin, 18, { align: 'right' });
  doc.text(`Currency: Indian Rupee (INR / Rs.)`, pageWidth - margin, 23, { align: 'right' });

  // --- Account & Statement Details Grid ---
  let cursorY = 36;
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ACCOUNT SUMMARY', margin, cursorY);

  cursorY += 5;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, cursorY, pageWidth - margin * 2, 22, 2, 2, 'FD');

  // Account Left Box Details
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Account Holder:', margin + 4, cursorY + 6);
  doc.text('User ID / Email:', margin + 4, cursorY + 12);
  doc.text('Statement Period:', margin + 4, cursorY + 18);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(user.username, margin + 34, cursorY + 6);
  doc.text(`${user.email || 'N/A (Local User)'}`, margin + 34, cursorY + 12);
  const periodText = (startDate || endDate) 
    ? `${startDate || 'Earliest'} to ${endDate || 'Latest'}` 
    : 'All Time Records';
  doc.text(periodText, margin + 34, cursorY + 18);

  // Account Right Box Details
  const midX = pageWidth / 2 + 10;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Total Records:', midX, cursorY + 6);
  doc.text('Account Status:', midX, cursorY + 12);
  doc.text('Statement Verification:', midX, cursorY + 18);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${transactions.length} Transactions`, midX + 38, cursorY + 6);
  doc.text(user.email_verified ? 'Verified Active' : 'Active Account', midX + 38, cursorY + 12);
  doc.text('Automated Ledger Extract', midX + 38, cursorY + 18);

  // --- Financial Executive Metric Cards ---
  cursorY += 28;
  const cardWidth = (pageWidth - margin * 2 - 8) / 3;

  // Inflow Card
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.setDrawColor(187, 247, 208); // emerald-200
  doc.roundedRect(margin, cursorY, cardWidth, 18, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(22, 101, 52); // emerald-800
  doc.text('TOTAL INFLOW (INCOME)', margin + 4, cursorY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text(`Rs. ${formatINRNumber(totalIncome)}`, margin + 4, cursorY + 13);

  // Outflow Card
  const card2X = margin + cardWidth + 4;
  doc.setFillColor(254, 242, 242); // rose-50
  doc.setDrawColor(254, 205, 211); // rose-200
  doc.roundedRect(card2X, cursorY, cardWidth, 18, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(159, 18, 57); // rose-800
  doc.text('TOTAL OUTFLOW (EXPENSES)', card2X + 4, cursorY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text(`Rs. ${formatINRNumber(totalExpense)}`, card2X + 4, cursorY + 13);

  // Net Balance Card
  const card3X = card2X + cardWidth + 4;
  doc.setFillColor(238, 242, 255); // indigo-50
  doc.setDrawColor(199, 210, 254); // indigo-200
  doc.roundedRect(card3X, cursorY, cardWidth, 18, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(55, 48, 163); // indigo-800
  doc.text('NET PERIOD MARGIN', card3X + 4, cursorY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(netSavings >= 0 ? 79 : 225, netSavings >= 0 ? 70 : 29, netSavings >= 0 ? 229 : 72);
  doc.text(`Rs. ${netSavings < 0 ? '-' : ''}${formatINRNumber(Math.abs(netSavings))}`, card3X + 4, cursorY + 13);

  cursorY += 24;

  // --- Transactions Table via autoTable ---
  const sortedTx = [...transactions].sort((a, b) => 
    b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)
  );

  const tableBody = sortedTx.map((t, idx) => [
    idx + 1,
    t.date,
    t.title + (t.notes ? `\nNote: ${t.notes}` : ''),
    t.category,
    t.payment_method,
    t.type.toUpperCase(),
    `${t.type === 'income' ? '+' : '-'} Rs. ${formatINRNumber(t.amount)}`
  ]);

  autoTable(doc, {
    startY: cursorY,
    head: [['#', 'Date', 'Description / Remarks', 'Category', 'Payment Mode', 'Type', 'Amount (INR)']],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      font: 'helvetica'
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 20, font: 'courier' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 32 },
      4: { cellWidth: 24 },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 30, halign: 'right', font: 'courier', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      // Highlight amount column based on income / expense
      if (data.section === 'body' && data.column.index === 6) {
        const text = String(data.cell.raw);
        if (text.startsWith('+')) {
          data.cell.styles.textColor = [5, 150, 105]; // emerald-600
        } else {
          data.cell.styles.textColor = [225, 29, 72]; // rose-600
        }
      }
      if (data.section === 'body' && data.column.index === 5) {
        const typeText = String(data.cell.raw);
        if (typeText === 'INCOME') {
          data.cell.styles.textColor = [5, 150, 105];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [225, 29, 72];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawPage: (_data) => {
      // Page numbering footer
      const currentDoc = doc as any;
      const totalPages = currentDoc.internal.getNumberOfPages();
      const currentPage = currentDoc.internal.getCurrentPageInfo().pageNumber;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.text(
        `Expense Analyzer • Confidential Financial Statement • Page ${currentPage} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );
    },
    margin: { left: margin, right: margin, bottom: 15 }
  });

  // Save the PDF
  const filename = `Transactions_Statement_${user.username}_${startDate || 'start'}_to_${endDate || 'end'}.pdf`;
  doc.save(filename);
}

/**
 * Generate and download an official Microsoft Word (.docx) document
 */
export async function exportTransactionsToWord(options: ExportStatementOptions): Promise<void> {
  const { user, transactions, startDate, endDate, reportTitle = 'TRANSACTION STATEMENT' } = options;

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netSavings = totalIncome - totalExpense;

  const sortedTx = [...transactions].sort((a, b) => 
    b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)
  );

  const generatedDateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const periodText = (startDate || endDate) 
    ? `${startDate || 'Earliest'} to ${endDate || 'Latest'}` 
    : 'Complete History (All Time)';

  // Build Table Rows
  const tableRows: TableRow[] = [
    // Header Row
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: '#', bold: true, color: 'FFFFFF' })] })],
          shading: { fill: '1E293B', type: ShadingType.CLEAR },
          width: { size: 5, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true, color: 'FFFFFF' })] })],
          shading: { fill: '1E293B', type: ShadingType.CLEAR },
          width: { size: 14, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Description', bold: true, color: 'FFFFFF' })] })],
          shading: { fill: '1E293B', type: ShadingType.CLEAR },
          width: { size: 31, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Category', bold: true, color: 'FFFFFF' })] })],
          shading: { fill: '1E293B', type: ShadingType.CLEAR },
          width: { size: 18, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Payment Method', bold: true, color: 'FFFFFF' })] })],
          shading: { fill: '1E293B', type: ShadingType.CLEAR },
          width: { size: 14, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Type', bold: true, color: 'FFFFFF' })] })],
          shading: { fill: '1E293B', type: ShadingType.CLEAR },
          width: { size: 8, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ 
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'Amount (₹)', bold: true, color: 'FFFFFF' })] 
          })],
          shading: { fill: '1E293B', type: ShadingType.CLEAR },
          width: { size: 15, type: WidthType.PERCENTAGE }
        }),
      ]
    }),
    // Data Rows
    ...sortedTx.map((t, idx) => {
      const isIncome = t.type === 'income';
      const rowBg = idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF';
      return new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: String(idx + 1) })],
            shading: { fill: rowBg, type: ShadingType.CLEAR }
          }),
          new TableCell({
            children: [new Paragraph({ text: t.date })],
            shading: { fill: rowBg, type: ShadingType.CLEAR }
          }),
          new TableCell({
            children: [
              new Paragraph({ children: [new TextRun({ text: t.title, bold: true })] }),
              ...(t.notes ? [new Paragraph({ children: [new TextRun({ text: `Note: ${t.notes}`, italics: true, color: '64748B' })] })] : [])
            ],
            shading: { fill: rowBg, type: ShadingType.CLEAR }
          }),
          new TableCell({
            children: [new Paragraph({ text: t.category })],
            shading: { fill: rowBg, type: ShadingType.CLEAR }
          }),
          new TableCell({
            children: [new Paragraph({ text: t.payment_method })],
            shading: { fill: rowBg, type: ShadingType.CLEAR }
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ 
                text: t.type.toUpperCase(), 
                bold: true, 
                color: isIncome ? '059669' : 'E11D48' 
              })] 
            })],
            shading: { fill: rowBg, type: ShadingType.CLEAR }
          }),
          new TableCell({
            children: [new Paragraph({ 
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ 
                text: `${isIncome ? '+' : '-'} ₹${formatINRNumber(t.amount)}`, 
                bold: true, 
                color: isIncome ? '059669' : 'E11D48' 
              })] 
            })],
            shading: { fill: rowBg, type: ShadingType.CLEAR }
          }),
        ]
      });
    })
  ];

  // Category summary breakdown
  const categoryMap = new Map<string, number>();
  transactions.forEach(t => {
    categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + t.amount);
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 }
        }
      },
      children: [
        // Main Title
        new Paragraph({
          text: 'EXPENSE ANALYZER',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'EXPENSE ANALYZER', bold: true, color: '1E293B', size: 32 })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ 
              text: 'Personal Finance Ledger & Statement of Transactions', 
              italics: true, 
              color: '64748B',
              size: 20
            })
          ]
        }),
        new Paragraph({ text: '' }), // spacer

        // Metadata box
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Account Holder: ', bold: true }),
                        new TextRun(user.username),
                        new TextRun('\t'),
                        new TextRun({ text: 'Statement Date: ', bold: true }),
                        new TextRun(generatedDateStr)
                      ]
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Email / ID: ', bold: true }),
                        new TextRun(user.email || user.id),
                        new TextRun('\t'),
                        new TextRun({ text: 'Currency: ', bold: true }),
                        new TextRun('Indian Rupee (₹ / INR)')
                      ]
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Date Filter Range: ', bold: true }),
                        new TextRun(periodText),
                        new TextRun('\t'),
                        new TextRun({ text: 'Total Transactions: ', bold: true }),
                        new TextRun(String(transactions.length))
                      ]
                    })
                  ]
                })
              ]
            })
          ]
        }),
        new Paragraph({ text: '' }), // spacer

        // Financial Summary Strip
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: 'ECFDF5', type: ShadingType.CLEAR },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: 'TOTAL INFLOW (INCOME)', size: 18, color: '065F46' })]
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: `₹${formatINRNumber(totalIncome)}`, bold: true, size: 28, color: '059669' })]
                    })
                  ]
                }),
                new TableCell({
                  shading: { fill: 'FFF1F2', type: ShadingType.CLEAR },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: 'TOTAL OUTFLOW (EXPENSES)', size: 18, color: '9F1239' })]
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: `-₹${formatINRNumber(totalExpense)}`, bold: true, size: 28, color: 'E11D48' })]
                    })
                  ]
                }),
                new TableCell({
                  shading: { fill: 'EEF2FF', type: ShadingType.CLEAR },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: 'NET BALANCE / MARGIN', size: 18, color: '3730A3' })]
                    }),
                    new Paragraph({
                      children: [new TextRun({ 
                        text: `₹${netSavings < 0 ? '-' : ''}${formatINRNumber(Math.abs(netSavings))}`, 
                        bold: true, 
                        size: 28, 
                        color: netSavings >= 0 ? '4F46E5' : 'E11D48' 
                      })]
                    })
                  ]
                })
              ]
            })
          ]
        }),
        new Paragraph({ text: '' }), // spacer

        // Section Title: Detailed Ledger Table
        new Paragraph({
          text: 'ITEMIZED TRANSACTION LEDGER',
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: 'Itemized Transaction Ledger', bold: true, color: '1E293B', size: 24 })]
        }),
        new Paragraph({ text: '' }),

        // Main Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows
        }),

        new Paragraph({ text: '' }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ 
              text: '--- End of Statement • Generated securely by Expense Pattern Analyzer ---', 
              italics: true, 
              color: '94A3B8',
              size: 16 
            })
          ]
        })
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Transactions_Statement_${user.username}_${startDate || 'start'}_to_${endDate || 'end'}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
