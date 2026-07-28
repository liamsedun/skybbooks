import { relations } from 'drizzle-orm';
import {
  organisations,
  users,
  sessions,
  accounts,
  journalEntries,
  journalLines,
  contacts,
  items,
  inventoryLots,
  inventoryTransactions,
  inventoryTransfers,
  inventoryTransferItems,
  inventoryStockCounts,
  inventoryStockCountItems,
  inventoryWriteoffs,
  inventoryWriteoffItems,
  landedCosts,
  landedCostAllocations,
  quotes,
  salesOrders,
  recurringInvoices,
  recurringBills,
  invoices,
  invoiceLines,
  paymentsReceived,
  paymentAllocations,
  creditNotes,
  purchaseOrders,
  bills,
  billLines,
  paymentsMade,
  paymentMadeAllocations,
  vendorCredits,
  expenses,
  bankAccounts,
  bankTransactions,
  bankRules,
  bankConnections,
  paymentGatewayTransactions,
  employees,
  payrollRuns,
  payrollLines,
  fixedAssets,
  depreciationEntries,
  assetClasses,
  assetComponents,
  revaluationEntries,
  impairmentEntries,
  maintenanceRecords,
  assetTransfers,
  documents,
  budgets,
  budgetLines,
  accountingRules,
  auditLog,
  chatConversations,
  chatConversationParticipants,
  chatReadMarkers,
  chatMessages,
  currencyRates,
  closedPeriods,
  taxConfigurations,
  capitalAllowanceSchedule,
  taxLosses,
  taxComputations,
  payeSchedules,
  revenueContracts,
  performanceObligations,
  revenueSchedules,
  revenueRecognitionEntries,
  leases,
  leasePaymentSchedules,
  leaseJournalEntries,
  eclParameters,
  eclComputations,
  groups,
  groupMembers,
  userOrganisationAccess,
  intercompanyTransactions,
  intercompanyEliminations,
  groupConsolidationRuns,
  approvalWorkflows,
  approvalHistory,
  ocrDocuments,
  projects,
  rolePermissions,
  crmStages,
  crmDeals,
  crmActivities,
  hrDepartments,
  hrDesignations,
  hrEmployees,
  hrEmployeeDocuments,
  hrEmergencyContacts,
  hrJobOpenings,
  hrCandidates,
  hrCandidateApplications,
  hrOnboardingTasks,
  hrLeaveTypes,
  hrLeaveRequests,
  hrLeaveBalances,
  hrAttendanceRecords,
  hrShifts,
  hrTimesheets,
  hrTimesheetEntries,
  hrPerformanceReviews,
  hrCourses,
  hrEnrollments,
  hrPulseSurveys,
  hrSurveyResponses,
  hrAnnouncements,
  hrRecognition,
  hrLetterTemplates,
  hrLetters,
  hrTravelRequests,
  hrExpenseReports,
  hrExpenseEntries,
  hrTravelAdvances,
  hrTravelSettlements,
  hrCompensationBands,
  hrEmployeeCompensation,
  hrBenefits,
  hrEmployeeBenefits,
  hrTasks,
  hrWorkflowTemplates,
  hrGoalCycles,
  hrOkrs,
  hrKeyResults,
  hrOffboardingTasks,
  hrExitInterviews,
  hrHelpTickets,
  hrTicketResponses,
  hrApprovalConfigs,
  hrApprovalRequests,
  hrSettings,
  hrPolicies,
  hrDocCategories,
  hrDocFiles,
  hrDocVersions,
  hrDocPermissions,
  hrDocEmployeeLinks,
  hrApprovalComments,
  hrApprovalDelegations,
  hrApprovalEscalationRules,
  hrApprovalStepInstances,
  hrAutomationRules,
  hrCalendarEvents,
  hrDocumentRequests,
  hrNotifications,
  hrPolicyAcknowledgements,
  hrReminderConfigs,
  hrRenewalTracking,
  hrWorkflowInstances,
} from './tables';

export const organisationsRelations = relations(organisations, ({ many }) => ({
  users: many(users),
  accounts: many(accounts),
  contacts: many(contacts),
  items: many(items),
  quotes: many(quotes),
  salesOrders: many(salesOrders),
  invoices: many(invoices),
  paymentsReceived: many(paymentsReceived),
  creditNotes: many(creditNotes),
  recurringInvoices: many(recurringInvoices),
  purchaseOrders: many(purchaseOrders),
  bills: many(bills),
  paymentsMade: many(paymentsMade),
  vendorCredits: many(vendorCredits),
  expenses: many(expenses),
  bankAccounts: many(bankAccounts),
  bankTransactions: many(bankTransactions),
  bankRules: many(bankRules),
  bankConnections: many(bankConnections),
  paymentGatewayTransactions: many(paymentGatewayTransactions),
  employees: many(employees),
  payrollRuns: many(payrollRuns),
  fixedAssets: many(fixedAssets),
  documents: many(documents),
  ocrDocuments: many(ocrDocuments),
  budgets: many(budgets),
  auditLog: many(auditLog),
  currencyRates: many(currencyRates),
  groupMemberships: many(groupMembers, { relationName: 'orgGroupMembers' }),
  intercompanyFromTxns: many(intercompanyTransactions, { relationName: 'icFromOrg' }),
  intercompanyToTxns: many(intercompanyTransactions, { relationName: 'icToOrg' }),
  eliminationsFrom: many(intercompanyEliminations, { relationName: 'elimFromOrg' }),
  eliminationsTo: many(intercompanyEliminations, { relationName: 'elimToOrg' }),
  userAccess: many(userOrganisationAccess),
  crmStages: many(crmStages),
  crmDeals: many(crmDeals),
  crmActivities: many(crmActivities),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [users.organisationId],
    references: [organisations.id]
  }),
  sessions: many(sessions),
  queriesCreated: many(journalEntries, { relationName: 'createdBy' }),
  queriesReversed: many(journalEntries, { relationName: 'reversedById' }),
  quotesCreated: many(quotes),
  soCreated: many(salesOrders),
  invoicesCreated: many(invoices),
  paymentsRecvCreated: many(paymentsReceived),
  creditNotesCreated: many(creditNotes),
  recurringInvoicesCreated: many(recurringInvoices),
  poCreated: many(purchaseOrders),
  billsCreated: many(bills),
  paymentsMadeCreated: many(paymentsMade),
  vendorCreditsCreated: many(vendorCredits),
  expensesCreated: many(expenses),
  payrollProcessed: many(payrollRuns),
  documentsUploaded: many(documents),
  budgetsCreated: many(budgets),
  actionsPerformed: many(auditLog),
  organisationAccess: many(userOrganisationAccess),
  intercompanyTxnsCreated: many(intercompanyTransactions, { relationName: 'icCreatedBy' }),
  eliminationsCreated: many(intercompanyEliminations, { relationName: 'elimCreatedBy' }),
  consolidationsCreated: many(groupConsolidationRuns, { relationName: 'consolCreatedBy' }),
  assignedDeals: many(crmDeals, { relationName: 'dealAssignee' }),
  assignedActivities: many(crmActivities, { relationName: 'activityAssignee' }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id]
  })
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [accounts.orgId],
    references: [organisations.id]
  }),
  parentAccount: one(accounts, {
    fields: [accounts.parentId],
    references: [accounts.id],
    relationName: 'accountsHierarchy'
  }),
  subAccounts: many(accounts, { relationName: 'accountsHierarchy' }),
  journalLines: many(journalLines),
  itemsSales: many(items, { relationName: 'salesAccountId' }),
  itemsPurchase: many(items, { relationName: 'purchaseAccountId' }),
  itemsInventory: many(items, { relationName: 'inventoryAccountId' }),
  invoiceLines: many(invoiceLines),
  paymentsReceived: many(paymentsReceived),
  billLines: many(billLines),
  paymentsMade: many(paymentsMade),
  expenses: many(expenses),
  bankAccounts: many(bankAccounts),
  fixedAssets: many(fixedAssets),
  budgetLines: many(budgetLines)
}));

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [journalEntries.orgId],
    references: [organisations.id]
  }),
  creator: one(users, {
    fields: [journalEntries.createdBy],
    references: [users.id],
    relationName: 'createdBy'
  }),
  reverser: one(users, {
    fields: [journalEntries.reversedById],
    references: [users.id],
    relationName: 'reversedById'
  }),
  lines: many(journalLines),
  invoices: many(invoices),
  creditNotes: many(creditNotes),
  bills: many(bills),
  vendorCredits: many(vendorCredits),
  expenses: many(expenses),
  payrollRuns: many(payrollRuns),
  depreciationEntries: many(depreciationEntries),
  paymentsMade: many(paymentsMade)
}));

export const journalLinesRelations = relations(journalLines, ({ one, many }) => ({
  entry: one(journalEntries, {
    fields: [journalLines.entryId],
    references: [journalEntries.id]
  }),
  account: one(accounts, {
    fields: [journalLines.accountId],
    references: [accounts.id]
  }),
  bankTransactions: many(bankTransactions)
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [contacts.orgId],
    references: [organisations.id]
  }),
  quotes: many(quotes),
  salesOrders: many(salesOrders),
  recurringInvoices: many(recurringInvoices),
  invoices: many(invoices),
  paymentsReceived: many(paymentsReceived),
  creditNotes: many(creditNotes),
  purchaseOrders: many(purchaseOrders),
  bills: many(bills),
  paymentsMade: many(paymentsMade),
  vendorCredits: many(vendorCredits),
  vendorExpenses: many(expenses, { relationName: 'vendorId' }),
  customerExpenses: many(expenses, { relationName: 'customerId' }),
  crmDeals: many(crmDeals),
  crmActivities: many(crmActivities),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [items.orgId],
    references: [organisations.id]
  }),
  salesAccount: one(accounts, {
    fields: [items.salesAccountId],
    references: [accounts.id],
    relationName: 'salesAccountId'
  }),
  purchaseAccount: one(accounts, {
    fields: [items.purchaseAccountId],
    references: [accounts.id],
    relationName: 'purchaseAccountId'
  }),
  inventoryAccount: one(accounts, {
    fields: [items.inventoryAccountId],
    references: [accounts.id],
    relationName: 'inventoryAccountId'
  }),
  inventoryLots: many(inventoryLots),
  inventoryTransactions: many(inventoryTransactions),
  inventoryTransfers: many(inventoryTransfers),
  inventoryTransferItems: many(inventoryTransferItems),
  inventoryStockCounts: many(inventoryStockCounts),
  inventoryStockCountItems: many(inventoryStockCountItems),
  inventoryWriteoffs: many(inventoryWriteoffs),
  inventoryWriteoffItems: many(inventoryWriteoffItems),
  landedCosts: many(landedCosts),
  landedCostAllocations: many(landedCostAllocations),
  invoiceLines: many(invoiceLines),
  billLines: many(billLines)
}));

export const inventoryLotsRelations = relations(inventoryLots, ({ one, many }) => ({
  item: one(items, {
    fields: [inventoryLots.itemId],
    references: [items.id]
  }),
  organisation: one(organisations, {
    fields: [inventoryLots.orgId],
    references: [organisations.id]
  }),
  inventoryTransactions: many(inventoryTransactions)
}));

export const inventoryTransactionsRelations = relations(inventoryTransactions, ({ one }) => ({
  item: one(items, {
    fields: [inventoryTransactions.itemId],
    references: [items.id]
  }),
  organisation: one(organisations, {
    fields: [inventoryTransactions.orgId],
    references: [organisations.id]
  }),
  lot: one(inventoryLots, {
    fields: [inventoryTransactions.lotId],
    references: [inventoryLots.id]
  })
}));

export const inventoryTransfersRelations = relations(inventoryTransfers, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [inventoryTransfers.orgId],
    references: [organisations.id]
  }),
  items: many(inventoryTransferItems),
  createdByUser: one(users, {
    fields: [inventoryTransfers.createdBy],
    references: [users.id]
  })
}));

export const inventoryTransferItemsRelations = relations(inventoryTransferItems, ({ one }) => ({
  transfer: one(inventoryTransfers, {
    fields: [inventoryTransferItems.transferId],
    references: [inventoryTransfers.id]
  }),
  item: one(items, {
    fields: [inventoryTransferItems.itemId],
    references: [items.id]
  }),
  lot: one(inventoryLots, {
    fields: [inventoryTransferItems.lotId],
    references: [inventoryLots.id]
  })
}));

export const inventoryStockCountsRelations = relations(inventoryStockCounts, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [inventoryStockCounts.orgId],
    references: [organisations.id]
  }),
  items: many(inventoryStockCountItems),
  createdByUser: one(users, {
    fields: [inventoryStockCounts.createdBy],
    references: [users.id]
  })
}));

export const inventoryStockCountItemsRelations = relations(inventoryStockCountItems, ({ one }) => ({
  count: one(inventoryStockCounts, {
    fields: [inventoryStockCountItems.countId],
    references: [inventoryStockCounts.id]
  }),
  item: one(items, {
    fields: [inventoryStockCountItems.itemId],
    references: [items.id]
  }),
  lot: one(inventoryLots, {
    fields: [inventoryStockCountItems.lotId],
    references: [inventoryLots.id]
  })
}));

export const inventoryWriteoffsRelations = relations(inventoryWriteoffs, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [inventoryWriteoffs.orgId],
    references: [organisations.id]
  }),
  items: many(inventoryWriteoffItems),
  account: one(accounts, {
    fields: [inventoryWriteoffs.accountId],
    references: [accounts.id]
  }),
  createdByUser: one(users, {
    fields: [inventoryWriteoffs.createdBy],
    references: [users.id]
  })
}));

export const inventoryWriteoffItemsRelations = relations(inventoryWriteoffItems, ({ one }) => ({
  writeoff: one(inventoryWriteoffs, {
    fields: [inventoryWriteoffItems.writeoffId],
    references: [inventoryWriteoffs.id]
  }),
  item: one(items, {
    fields: [inventoryWriteoffItems.itemId],
    references: [items.id]
  }),
  lot: one(inventoryLots, {
    fields: [inventoryWriteoffItems.lotId],
    references: [inventoryLots.id]
  })
}));

export const landedCostsRelations = relations(landedCosts, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [landedCosts.orgId],
    references: [organisations.id]
  }),
  bill: one(bills, {
    fields: [landedCosts.billId],
    references: [bills.id]
  }),
  allocations: many(landedCostAllocations),
  createdByUser: one(users, {
    fields: [landedCosts.createdBy],
    references: [users.id]
  })
}));

export const landedCostAllocationsRelations = relations(landedCostAllocations, ({ one }) => ({
  landedCost: one(landedCosts, {
    fields: [landedCostAllocations.landedCostId],
    references: [landedCosts.id]
  }),
  item: one(items, {
    fields: [landedCostAllocations.itemId],
    references: [items.id]
  }),
  billLine: one(billLines, {
    fields: [landedCostAllocations.billLineId],
    references: [billLines.id]
  }),
  lot: one(inventoryLots, {
    fields: [landedCostAllocations.lotId],
    references: [inventoryLots.id]
  })
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [quotes.orgId],
    references: [organisations.id]
  }),
  customer: one(contacts, {
    fields: [quotes.customerId],
    references: [contacts.id]
  }),
  creator: one(users, {
    fields: [quotes.createdBy],
    references: [users.id]
  }),
  salesOrders: many(salesOrders)
}));

export const salesOrdersRelations = relations(salesOrders, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [salesOrders.orgId],
    references: [organisations.id]
  }),
  customer: one(contacts, {
    fields: [salesOrders.customerId],
    references: [contacts.id]
  }),
  quote: one(quotes, {
    fields: [salesOrders.quoteId],
    references: [quotes.id]
  }),
  creator: one(users, {
    fields: [salesOrders.createdBy],
    references: [users.id]
  }),
  invoices: many(invoices)
}));

export const recurringInvoicesRelations = relations(recurringInvoices, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [recurringInvoices.orgId],
    references: [organisations.id]
  }),
  customer: one(contacts, {
    fields: [recurringInvoices.customerId],
    references: [contacts.id]
  }),
  creator: one(users, {
    fields: [recurringInvoices.createdBy],
    references: [users.id]
  }),
  invoices: many(invoices)
}));

export const recurringBillsRelations = relations(recurringBills, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [recurringBills.orgId],
    references: [organisations.id]
  }),
  vendor: one(contacts, {
    fields: [recurringBills.vendorId],
    references: [contacts.id]
  }),
  creator: one(users, {
    fields: [recurringBills.createdBy],
    references: [users.id]
  }),
  bills: many(bills)
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [invoices.orgId],
    references: [organisations.id]
  }),
  customer: one(contacts, {
    fields: [invoices.customerId],
    references: [contacts.id]
  }),
  salesOrder: one(salesOrders, {
    fields: [invoices.soId],
    references: [salesOrders.id]
  }),
  recurringInvoice: one(recurringInvoices, {
    fields: [invoices.recurringId],
    references: [recurringInvoices.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [invoices.journalEntryId],
    references: [journalEntries.id]
  }),
  creator: one(users, {
    fields: [invoices.createdBy],
    references: [users.id]
  }),
  lines: many(invoiceLines),
  paymentAllocations: many(paymentAllocations),
  creditNotes: many(creditNotes)
}));

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLines.invoiceId],
    references: [invoices.id]
  }),
  item: one(items, {
    fields: [invoiceLines.itemId],
    references: [items.id]
  }),
  account: one(accounts, {
    fields: [invoiceLines.accountId],
    references: [accounts.id]
  })
}));

export const paymentsReceivedRelations = relations(paymentsReceived, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [paymentsReceived.orgId],
    references: [organisations.id]
  }),
  customer: one(contacts, {
    fields: [paymentsReceived.customerId],
    references: [contacts.id]
  }),
  account: one(accounts, {
    fields: [paymentsReceived.accountId],
    references: [accounts.id]
  }),
  creator: one(users, {
    fields: [paymentsReceived.createdBy],
    references: [users.id]
  }),
  paymentAllocations: many(paymentAllocations)
}));

export const paymentAllocationsRelations = relations(paymentAllocations, ({ one }) => ({
  payment: one(paymentsReceived, {
    fields: [paymentAllocations.paymentId],
    references: [paymentsReceived.id]
  }),
  invoice: one(invoices, {
    fields: [paymentAllocations.invoiceId],
    references: [invoices.id]
  })
}));

export const creditNotesRelations = relations(creditNotes, ({ one }) => ({
  organisation: one(organisations, {
    fields: [creditNotes.orgId],
    references: [organisations.id]
  }),
  customer: one(contacts, {
    fields: [creditNotes.customerId],
    references: [contacts.id]
  }),
  invoice: one(invoices, {
    fields: [creditNotes.invoiceId],
    references: [invoices.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [creditNotes.journalEntryId],
    references: [journalEntries.id]
  }),
  creator: one(users, {
    fields: [creditNotes.createdBy],
    references: [users.id]
  })
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [purchaseOrders.orgId],
    references: [organisations.id]
  }),
  vendor: one(contacts, {
    fields: [purchaseOrders.vendorId],
    references: [contacts.id]
  }),
  creator: one(users, {
    fields: [purchaseOrders.createdBy],
    references: [users.id]
  }),
  bills: many(bills)
}));

export const billsRelations = relations(bills, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [bills.orgId],
    references: [organisations.id]
  }),
  vendor: one(contacts, {
    fields: [bills.vendorId],
    references: [contacts.id]
  }),
  purchaseOrder: one(purchaseOrders, {
    fields: [bills.poId],
    references: [purchaseOrders.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [bills.journalEntryId],
    references: [journalEntries.id]
  }),
  creator: one(users, {
    fields: [bills.createdBy],
    references: [users.id]
  }),
  recurringBill: one(recurringBills, {
    fields: [bills.recurringId],
    references: [recurringBills.id]
  }),
  lines: many(billLines),
  paymentMadeAllocations: many(paymentMadeAllocations),
  vendorCredits: many(vendorCredits)
}));

export const billLinesRelations = relations(billLines, ({ one }) => ({
  bill: one(bills, {
    fields: [billLines.billId],
    references: [bills.id]
  }),
  item: one(items, {
    fields: [billLines.itemId],
    references: [items.id]
  }),
  account: one(accounts, {
    fields: [billLines.accountId],
    references: [accounts.id]
  })
}));

export const paymentsMadeRelations = relations(paymentsMade, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [paymentsMade.orgId],
    references: [organisations.id]
  }),
  vendor: one(contacts, {
    fields: [paymentsMade.vendorId],
    references: [contacts.id]
  }),
  account: one(accounts, {
    fields: [paymentsMade.accountId],
    references: [accounts.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [paymentsMade.journalEntryId],
    references: [journalEntries.id]
  }),
  creator: one(users, {
    fields: [paymentsMade.createdBy],
    references: [users.id]
  }),
  paymentAllocations: many(paymentMadeAllocations)
}));

export const paymentMadeAllocationsRelations = relations(paymentMadeAllocations, ({ one }) => ({
  payment: one(paymentsMade, {
    fields: [paymentMadeAllocations.paymentId],
    references: [paymentsMade.id]
  }),
  bill: one(bills, {
    fields: [paymentMadeAllocations.billId],
    references: [bills.id]
  })
}));

export const vendorCreditsRelations = relations(vendorCredits, ({ one }) => ({
  organisation: one(organisations, {
    fields: [vendorCredits.orgId],
    references: [organisations.id]
  }),
  vendor: one(contacts, {
    fields: [vendorCredits.vendorId],
    references: [contacts.id]
  }),
  bill: one(bills, {
    fields: [vendorCredits.billId],
    references: [bills.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [vendorCredits.journalEntryId],
    references: [journalEntries.id]
  }),
  creator: one(users, {
    fields: [vendorCredits.createdBy],
    references: [users.id]
  })
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  organisation: one(organisations, {
    fields: [expenses.orgId],
    references: [organisations.id]
  }),
  vendor: one(contacts, {
    fields: [expenses.vendorId],
    references: [contacts.id],
    relationName: 'vendorId'
  }),
  account: one(accounts, {
    fields: [expenses.accountId],
    references: [accounts.id]
  }),
  customer: one(contacts, {
    fields: [expenses.customerId],
    references: [contacts.id],
    relationName: 'customerId'
  }),
  journalEntry: one(journalEntries, {
    fields: [expenses.journalEntryId],
    references: [journalEntries.id]
  }),
  creator: one(users, {
    fields: [expenses.createdBy],
    references: [users.id]
  })
}));

export const bankAccountsRelations = relations(bankAccounts, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [bankAccounts.orgId],
    references: [organisations.id]
  }),
  account: one(accounts, {
    fields: [bankAccounts.accountId],
    references: [accounts.id]
  }),
  transactions: many(bankTransactions)
}));

export const bankTransactionsRelations = relations(bankTransactions, ({ one }) => ({
  bankAccount: one(bankAccounts, {
    fields: [bankTransactions.bankAccountId],
    references: [bankAccounts.id]
  }),
  organisation: one(organisations, {
    fields: [bankTransactions.orgId],
    references: [organisations.id]
  }),
  journalLine: one(journalLines, {
    fields: [bankTransactions.journalLineId],
    references: [journalLines.id]
  })
}));

export const bankRulesRelations = relations(bankRules, ({ one }) => ({
  organisation: one(organisations, {
    fields: [bankRules.orgId],
    references: [organisations.id]
  })
}));

export const bankConnectionsRelations = relations(bankConnections, ({ one }) => ({
  organisation: one(organisations, {
    fields: [bankConnections.orgId],
    references: [organisations.id]
  }),
  bankAccount: one(bankAccounts, {
    fields: [bankConnections.bankAccountId],
    references: [bankAccounts.id]
  }),
}));

export const paymentGatewayTransactionsRelations = relations(paymentGatewayTransactions, ({ one }) => ({
  organisation: one(organisations, {
    fields: [paymentGatewayTransactions.orgId],
    references: [organisations.id]
  }),
  bankAccount: one(bankAccounts, {
    fields: [paymentGatewayTransactions.bankAccountId],
    references: [bankAccounts.id]
  }),
  matchedTransaction: one(bankTransactions, {
    fields: [paymentGatewayTransactions.matchedTransactionId],
    references: [bankTransactions.id]
  }),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [employees.orgId],
    references: [organisations.id]
  }),
  payrollLines: many(payrollLines)
}));

export const payrollRunsRelations = relations(payrollRuns, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [payrollRuns.orgId],
    references: [organisations.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [payrollRuns.journalEntryId],
    references: [journalEntries.id]
  }),
  processedByUser: one(users, {
    fields: [payrollRuns.processedBy],
    references: [users.id]
  }),
  lines: many(payrollLines)
}));

export const payrollLinesRelations = relations(payrollLines, ({ one }) => ({
  run: one(payrollRuns, {
    fields: [payrollLines.runId],
    references: [payrollRuns.id]
  }),
  employee: one(employees, {
    fields: [payrollLines.employeeId],
    references: [employees.id]
  })
}));

export const fixedAssetsRelations = relations(fixedAssets, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [fixedAssets.orgId],
    references: [organisations.id]
  }),
  account: one(accounts, {
    fields: [fixedAssets.accountId],
    references: [accounts.id]
  }),
  assetClass: one(assetClasses, {
    fields: [fixedAssets.assetClassId],
    references: [assetClasses.id]
  }),
  revaluationSurplusAccount: one(accounts, {
    fields: [fixedAssets.revaluationSurplusAccountId],
    references: [accounts.id],
    relationName: 'faRevaluationSurplusAccount'
  }),
  disposalAccount: one(accounts, {
    fields: [fixedAssets.disposalAccountId],
    references: [accounts.id],
    relationName: 'faDisposalAccount'
  }),
  cwipSource: one(fixedAssets, {
    fields: [fixedAssets.cwipSourceId],
    references: [fixedAssets.id],
    relationName: 'cwipSource'
  }),
  cwipDerived: many(fixedAssets, { relationName: 'cwipSource' }),
  depreciationEntries: many(depreciationEntries),
  components: many(assetComponents),
  revaluations: many(revaluationEntries),
  impairments: many(impairmentEntries),
  maintenanceRecords: many(maintenanceRecords),
  transfers: many(assetTransfers)
}));

export const depreciationEntriesRelations = relations(depreciationEntries, ({ one }) => ({
  asset: one(fixedAssets, {
    fields: [depreciationEntries.assetId],
    references: [fixedAssets.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [depreciationEntries.journalEntryId],
    references: [journalEntries.id]
  })
}));

export const assetClassesRelations = relations(assetClasses, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [assetClasses.orgId],
    references: [organisations.id]
  }),
  glAssetAccount: one(accounts, {
    fields: [assetClasses.glAssetAccountId],
    references: [accounts.id],
    relationName: 'acGlAssetAccount'
  }),
  glDepreciationExpenseAccount: one(accounts, {
    fields: [assetClasses.glDepreciationExpenseAccountId],
    references: [accounts.id],
    relationName: 'acGlDeprExpenseAccount'
  }),
  glAccumDeprAccount: one(accounts, {
    fields: [assetClasses.glAccumDeprAccountId],
    references: [accounts.id],
    relationName: 'acGlAccumDeprAccount'
  }),
  glRevaluationReserveAccount: one(accounts, {
    fields: [assetClasses.glRevaluationReserveAccountId],
    references: [accounts.id],
    relationName: 'acGlRevalReserveAccount'
  }),
  glDisposalProceedsAccount: one(accounts, {
    fields: [assetClasses.glDisposalProceedsAccountId],
    references: [accounts.id],
    relationName: 'acGlDisposalProceedsAccount'
  }),
  glDisposalLossAccount: one(accounts, {
    fields: [assetClasses.glDisposalLossAccountId],
    references: [accounts.id],
    relationName: 'acGlDisposalLossAccount'
  }),
  assets: many(fixedAssets)
}));

export const assetComponentsRelations = relations(assetComponents, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [assetComponents.orgId],
    references: [organisations.id]
  }),
  asset: one(fixedAssets, {
    fields: [assetComponents.assetId],
    references: [fixedAssets.id]
  }),
  glAssetAccount: one(accounts, {
    fields: [assetComponents.glAssetAccountId],
    references: [accounts.id],
    relationName: 'acompGlAssetAccount'
  }),
  glAccumDeprAccount: one(accounts, {
    fields: [assetComponents.glAccumDeprAccountId],
    references: [accounts.id],
    relationName: 'acompGlAccumDeprAccount'
  }),
  revaluations: many(revaluationEntries),
  impairments: many(impairmentEntries),
  maintenanceRecords: many(maintenanceRecords)
}));

export const revaluationEntriesRelations = relations(revaluationEntries, ({ one }) => ({
  organisation: one(organisations, {
    fields: [revaluationEntries.orgId],
    references: [organisations.id]
  }),
  asset: one(fixedAssets, {
    fields: [revaluationEntries.assetId],
    references: [fixedAssets.id]
  }),
  component: one(assetComponents, {
    fields: [revaluationEntries.componentId],
    references: [assetComponents.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [revaluationEntries.journalEntryId],
    references: [journalEntries.id]
  }),
  createdByUser: one(users, {
    fields: [revaluationEntries.createdBy],
    references: [users.id]
  })
}));

export const impairmentEntriesRelations = relations(impairmentEntries, ({ one }) => ({
  organisation: one(organisations, {
    fields: [impairmentEntries.orgId],
    references: [organisations.id]
  }),
  asset: one(fixedAssets, {
    fields: [impairmentEntries.assetId],
    references: [fixedAssets.id]
  }),
  component: one(assetComponents, {
    fields: [impairmentEntries.componentId],
    references: [assetComponents.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [impairmentEntries.journalEntryId],
    references: [journalEntries.id]
  }),
  createdByUser: one(users, {
    fields: [impairmentEntries.createdBy],
    references: [users.id]
  })
}));

export const maintenanceRecordsRelations = relations(maintenanceRecords, ({ one }) => ({
  organisation: one(organisations, {
    fields: [maintenanceRecords.orgId],
    references: [organisations.id]
  }),
  asset: one(fixedAssets, {
    fields: [maintenanceRecords.assetId],
    references: [fixedAssets.id]
  }),
  component: one(assetComponents, {
    fields: [maintenanceRecords.componentId],
    references: [assetComponents.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [maintenanceRecords.journalEntryId],
    references: [journalEntries.id]
  }),
  createdByUser: one(users, {
    fields: [maintenanceRecords.createdBy],
    references: [users.id]
  })
}));

export const assetTransfersRelations = relations(assetTransfers, ({ one }) => ({
  organisation: one(organisations, {
    fields: [assetTransfers.orgId],
    references: [organisations.id]
  }),
  asset: one(fixedAssets, {
    fields: [assetTransfers.assetId],
    references: [fixedAssets.id]
  }),
  authorizedByUser: one(users, {
    fields: [assetTransfers.authorizedBy],
    references: [users.id],
    relationName: 'atAuthorizedBy'
  }),
  createdByUser: one(users, {
    fields: [assetTransfers.createdBy],
    references: [users.id],
    relationName: 'atCreatedBy'
  })
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  organisation: one(organisations, {
    fields: [documents.orgId],
    references: [organisations.id]
  }),
  uploader: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id]
  })
}));

export const budgetsRelations = relations(budgets, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [budgets.orgId],
    references: [organisations.id]
  }),
  creator: one(users, {
    fields: [budgets.createdBy],
    references: [users.id]
  }),
  lines: many(budgetLines)
}));

export const budgetLinesRelations = relations(budgetLines, ({ one }) => ({
  budget: one(budgets, {
    fields: [budgetLines.budgetId],
    references: [budgets.id]
  }),
  account: one(accounts, {
    fields: [budgetLines.accountId],
    references: [accounts.id]
  })
}));

export const accountingRulesRelations = relations(accountingRules, ({ one }) => ({
  organisation: one(organisations, {
    fields: [accountingRules.orgId],
    references: [organisations.id]
  }),
  account: one(accounts, {
    fields: [accountingRules.accountId],
    references: [accounts.id]
  })
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  organisation: one(organisations, {
    fields: [auditLog.orgId],
    references: [organisations.id]
  }),
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id]
  })
}));

export const chatConversationsRelations = relations(chatConversations, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [chatConversations.orgId],
    references: [organisations.id]
  }),
  participants: many(chatConversationParticipants),
  messages: many(chatMessages),
}));

export const chatConversationParticipantsRelations = relations(chatConversationParticipants, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatConversationParticipants.conversationId],
    references: [chatConversations.id]
  }),
  user: one(users, {
    fields: [chatConversationParticipants.userId],
    references: [users.id]
  }),
}));

export const chatReadMarkersRelations = relations(chatReadMarkers, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatReadMarkers.conversationId],
    references: [chatConversations.id]
  }),
  user: one(users, {
    fields: [chatReadMarkers.userId],
    references: [users.id]
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  organisation: one(organisations, {
    fields: [chatMessages.orgId],
    references: [organisations.id]
  }),
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id]
  }),
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id]
  }),
}));

export const currencyRatesRelations = relations(currencyRates, ({ one }) => ({
  organisation: one(organisations, {
    fields: [currencyRates.orgId],
    references: [organisations.id]
  })
}));

export const closedPeriodsRelations = relations(closedPeriods, ({ one }) => ({
  organisation: one(organisations, {
    fields: [closedPeriods.orgId],
    references: [organisations.id]
  }),
  closer: one(users, {
    fields: [closedPeriods.closedBy],
    references: [users.id]
  })
}));

export const taxConfigurationsRelations = relations(taxConfigurations, ({ one }) => ({
  organisation: one(organisations, {
    fields: [taxConfigurations.orgId],
    references: [organisations.id]
  })
}));

export const capitalAllowanceScheduleRelations = relations(capitalAllowanceSchedule, ({ one }) => ({
  organisation: one(organisations, {
    fields: [capitalAllowanceSchedule.orgId],
    references: [organisations.id]
  })
}));

export const taxLossesRelations = relations(taxLosses, ({ one }) => ({
  organisation: one(organisations, {
    fields: [taxLosses.orgId],
    references: [organisations.id]
  })
}));

export const taxComputationsRelations = relations(taxComputations, ({ one }) => ({
  organisation: one(organisations, {
    fields: [taxComputations.orgId],
    references: [organisations.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [taxComputations.journalEntryId],
    references: [journalEntries.id]
  })
}));

export const payeSchedulesRelations = relations(payeSchedules, ({ one }) => ({
  organisation: one(organisations, { fields: [payeSchedules.orgId], references: [organisations.id] }),
  journalEntry: one(journalEntries, { fields: [payeSchedules.journalEntryId], references: [journalEntries.id] })
}));

export const revenueContractsRelations = relations(revenueContracts, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [revenueContracts.orgId],
    references: [organisations.id]
  }),
  customer: one(contacts, {
    fields: [revenueContracts.customerId],
    references: [contacts.id]
  }),
  project: one(projects, {
    fields: [revenueContracts.projectId],
    references: [projects.id]
  }),
  creator: one(users, {
    fields: [revenueContracts.createdBy],
    references: [users.id]
  }),
  performanceObligations: many(performanceObligations),
}));

export const performanceObligationsRelations = relations(performanceObligations, ({ one, many }) => ({
  contract: one(revenueContracts, {
    fields: [performanceObligations.contractId],
    references: [revenueContracts.id]
  }),
  revenueAccount: one(accounts, {
    fields: [performanceObligations.revenueAccountId],
    references: [accounts.id]
  }),
  deferredRevenueAccount: one(accounts, {
    fields: [performanceObligations.deferredRevenueAccountId],
    references: [accounts.id]
  }),
  contractAssetAccount: one(accounts, {
    fields: [performanceObligations.contractAssetAccountId],
    references: [accounts.id]
  }),
  schedules: many(revenueSchedules),
  recognitionEntries: many(revenueRecognitionEntries),
}));

export const revenueSchedulesRelations = relations(revenueSchedules, ({ one, many }) => ({
  obligation: one(performanceObligations, {
    fields: [revenueSchedules.obligationId],
    references: [performanceObligations.id]
  }),
  recognitionEntries: many(revenueRecognitionEntries),
}));

export const revenueRecognitionEntriesRelations = relations(revenueRecognitionEntries, ({ one }) => ({
  schedule: one(revenueSchedules, {
    fields: [revenueRecognitionEntries.scheduleId],
    references: [revenueSchedules.id]
  }),
  obligation: one(performanceObligations, {
    fields: [revenueRecognitionEntries.obligationId],
    references: [performanceObligations.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [revenueRecognitionEntries.journalEntryId],
    references: [journalEntries.id]
  }),
  creator: one(users, {
    fields: [revenueRecognitionEntries.createdBy],
    references: [users.id]
  }),
}));

export const leasesRelations = relations(leases, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [leases.orgId],
    references: [organisations.id]
  }),
  creator: one(users, {
    fields: [leases.createdBy],
    references: [users.id]
  }),
  rouAssetAccount: one(accounts, {
    fields: [leases.rouAssetAccountId],
    references: [accounts.id]
  }),
  accumDepreciationAccount: one(accounts, {
    fields: [leases.accumDepreciationAccountId],
    references: [accounts.id]
  }),
  depreciationExpenseAccount: one(accounts, {
    fields: [leases.depreciationExpenseAccountId],
    references: [accounts.id]
  }),
  leaseLiabilityAccount: one(accounts, {
    fields: [leases.leaseLiabilityAccountId],
    references: [accounts.id]
  }),
  paymentSchedules: many(leasePaymentSchedules),
  journalEntries: many(leaseJournalEntries),
}));

export const leasePaymentSchedulesRelations = relations(leasePaymentSchedules, ({ one }) => ({
  lease: one(leases, {
    fields: [leasePaymentSchedules.leaseId],
    references: [leases.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [leasePaymentSchedules.journalEntryId],
    references: [journalEntries.id]
  }),
}));

export const leaseJournalEntriesRelations = relations(leaseJournalEntries, ({ one }) => ({
  lease: one(leases, {
    fields: [leaseJournalEntries.leaseId],
    references: [leases.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [leaseJournalEntries.journalEntryId],
    references: [journalEntries.id]
  }),
}));

export const eclParametersRelations = relations(eclParameters, ({ one }) => ({
  organisation: one(organisations, {
    fields: [eclParameters.orgId],
    references: [organisations.id]
  }),
}));

export const eclComputationsRelations = relations(eclComputations, ({ one }) => ({
  organisation: one(organisations, {
    fields: [eclComputations.orgId],
    references: [organisations.id]
  }),
  creator: one(users, {
    fields: [eclComputations.createdBy],
    references: [users.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [eclComputations.journalEntryId],
    references: [journalEntries.id]
  }),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
  intercompanyTransactions: many(intercompanyTransactions),
  eliminations: many(intercompanyEliminations),
  consolidationRuns: many(groupConsolidationRuns)
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id]
  }),
  organisation: one(organisations, {
    fields: [groupMembers.orgId],
    references: [organisations.id],
    relationName: 'orgGroupMembers'
  })
}));

export const userOrganisationAccessRelations = relations(userOrganisationAccess, ({ one }) => ({
  user: one(users, {
    fields: [userOrganisationAccess.userId],
    references: [users.id]
  }),
  organisation: one(organisations, {
    fields: [userOrganisationAccess.orgId],
    references: [organisations.id]
  })
}));

export const intercompanyTransactionsRelations = relations(intercompanyTransactions, ({ one }) => ({
  group: one(groups, {
    fields: [intercompanyTransactions.groupId],
    references: [groups.id]
  }),
  fromOrganisation: one(organisations, {
    fields: [intercompanyTransactions.fromOrgId],
    references: [organisations.id],
    relationName: 'icFromOrg'
  }),
  toOrganisation: one(organisations, {
    fields: [intercompanyTransactions.toOrgId],
    references: [organisations.id],
    relationName: 'icToOrg'
  }),
  fromJournalEntry: one(journalEntries, {
    fields: [intercompanyTransactions.fromJournalEntryId],
    references: [journalEntries.id]
  }),
  toJournalEntry: one(journalEntries, {
    fields: [intercompanyTransactions.toJournalEntryId],
    references: [journalEntries.id]
  }),
  creator: one(users, {
    fields: [intercompanyTransactions.createdBy],
    references: [users.id],
    relationName: 'icCreatedBy'
  })
}));

export const intercompanyEliminationsRelations = relations(intercompanyEliminations, ({ one }) => ({
  group: one(groups, {
    fields: [intercompanyEliminations.groupId],
    references: [groups.id]
  }),
  consolidationRun: one(groupConsolidationRuns, {
    fields: [intercompanyEliminations.consolidationRunId],
    references: [groupConsolidationRuns.id]
  }),
  transaction: one(intercompanyTransactions, {
    fields: [intercompanyEliminations.transactionId],
    references: [intercompanyTransactions.id]
  }),
  fromOrganisation: one(organisations, {
    fields: [intercompanyEliminations.fromOrgId],
    references: [organisations.id],
    relationName: 'elimFromOrg'
  }),
  toOrganisation: one(organisations, {
    fields: [intercompanyEliminations.toOrgId],
    references: [organisations.id],
    relationName: 'elimToOrg'
  }),
  journalEntry: one(journalEntries, {
    fields: [intercompanyEliminations.journalEntryId],
    references: [journalEntries.id]
  }),
  creator: one(users, {
    fields: [intercompanyEliminations.createdBy],
    references: [users.id],
    relationName: 'elimCreatedBy'
  })
}));

export const groupConsolidationRunsRelations = relations(groupConsolidationRuns, ({ one, many }) => ({
  group: one(groups, {
    fields: [groupConsolidationRuns.groupId],
    references: [groups.id]
  }),
  creator: one(users, {
    fields: [groupConsolidationRuns.createdBy],
    references: [users.id],
    relationName: 'consolCreatedBy'
  }),
  eliminations: many(intercompanyEliminations)
}));

export const approvalWorkflowsRelations = relations(approvalWorkflows, ({ one }) => ({
  org: one(organisations, { fields: [approvalWorkflows.orgId], references: [organisations.id] }),
}));

export const approvalHistoryRelations = relations(approvalHistory, ({ one }) => ({
  org: one(organisations, { fields: [approvalHistory.orgId], references: [organisations.id] }),
  performer: one(users, { fields: [approvalHistory.performedBy], references: [users.id] }),
}));

export const ocrDocumentsRelations = relations(ocrDocuments, ({ one }) => ({
  organisation: one(organisations, {
    fields: [ocrDocuments.orgId],
    references: [organisations.id]
  }),
  uploader: one(users, {
    fields: [ocrDocuments.uploadedBy],
    references: [users.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [ocrDocuments.journalEntryId],
    references: [journalEntries.id]
  }),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  organisation: one(organisations, {
    fields: [rolePermissions.orgId],
    references: [organisations.id]
  }),
}));

// --- CRM Relations ---

export const crmStagesRelations = relations(crmStages, ({ one, many }) => ({
  organisation: one(organisations, { fields: [crmStages.orgId], references: [organisations.id] }),
  deals: many(crmDeals),
}));

export const crmDealsRelations = relations(crmDeals, ({ one, many }) => ({
  organisation: one(organisations, { fields: [crmDeals.orgId], references: [organisations.id] }),
  contact: one(contacts, { fields: [crmDeals.contactId], references: [contacts.id] }),
  stage: one(crmStages, { fields: [crmDeals.stageId], references: [crmStages.id] }),
  assignee: one(users, { fields: [crmDeals.assignedTo], references: [users.id] }),
  activities: many(crmActivities),
}));

export const crmActivitiesRelations = relations(crmActivities, ({ one }) => ({
  organisation: one(organisations, { fields: [crmActivities.orgId], references: [organisations.id] }),
  deal: one(crmDeals, { fields: [crmActivities.dealId], references: [crmDeals.id] }),
  contact: one(contacts, { fields: [crmActivities.contactId], references: [contacts.id] }),
  assignee: one(users, { fields: [crmActivities.assignedTo], references: [users.id] }),
}));

// ================================================================
// HRM Relations
// ================================================================

export const hrDepartmentsRelations = relations(hrDepartments, ({ one, many }) => ({
  organisation: one(organisations, { fields: [hrDepartments.orgId], references: [organisations.id] }),
  head: one(hrEmployees, { fields: [hrDepartments.headEmployeeId], references: [hrEmployees.id], relationName: 'deptHead' }),
  parent: one(hrDepartments, { fields: [hrDepartments.parentId], references: [hrDepartments.id], relationName: 'deptParent' }),
  children: many(hrDepartments, { relationName: 'deptParent' }),
  designations: many(hrDesignations),
  employees: many(hrEmployees, { relationName: 'empDepartment' }),
  jobOpenings: many(hrJobOpenings),
}));

export const hrDesignationsRelations = relations(hrDesignations, ({ one, many }) => ({
  organisation: one(organisations, { fields: [hrDesignations.orgId], references: [organisations.id] }),
  department: one(hrDepartments, { fields: [hrDesignations.departmentId], references: [hrDepartments.id] }),
  employees: many(hrEmployees, { relationName: 'empDesignation' }),
  compensationBands: many(hrCompensationBands),
}));

export const hrEmployeesRelations = relations(hrEmployees, ({ one, many }) => ({
  organisation: one(organisations, { fields: [hrEmployees.orgId], references: [organisations.id] }),
  department: one(hrDepartments, { fields: [hrEmployees.departmentId], references: [hrDepartments.id] }),
  designation: one(hrDesignations, { fields: [hrEmployees.designationId], references: [hrDesignations.id] }),
  supervisor: one(hrEmployees, { fields: [hrEmployees.supervisorId], references: [hrEmployees.id], relationName: 'empSupervisor' }),
  subordinates: many(hrEmployees, { relationName: 'empSupervisor' }),
  user: one(users, { fields: [hrEmployees.userId], references: [users.id] }),
  documents: many(hrEmployeeDocuments),
  emergencyContacts: many(hrEmergencyContacts),
  leaveRequests: many(hrLeaveRequests),
  leaveBalances: many(hrLeaveBalances),
  attendanceRecords: many(hrAttendanceRecords),
  timesheets: many(hrTimesheets),
  performanceReviews: many(hrPerformanceReviews),
  enrollments: many(hrEnrollments),
  surveyResponses: many(hrSurveyResponses),
  givenRecognition: many(hrRecognition, { relationName: 'recognitionGiven' }),
  receivedRecognition: many(hrRecognition, { relationName: 'recognitionReceived' }),
  letters: many(hrLetters),
  travelRequests: many(hrTravelRequests),
  expenseReports: many(hrExpenseReports),
  compensation: many(hrEmployeeCompensation),
  employeeBenefits: many(hrEmployeeBenefits),
  tasks: many(hrTasks),
  okrs: many(hrOkrs),
  onboardingTasks: many(hrOnboardingTasks),
  offboardingTasks: many(hrOffboardingTasks),
  exitInterviews: many(hrExitInterviews),
  helpTickets: many(hrHelpTickets),
  ticketResponses: many(hrTicketResponses),
  approvalRequests: many(hrApprovalRequests, { relationName: 'approvalsRequested' }),
  approvalsAsApprover: many(hrApprovalRequests, { relationName: 'approvalsApproved' }),
}));

export const hrEmployeeDocumentsRelations = relations(hrEmployeeDocuments, ({ one }) => ({
  organisation: one(organisations, { fields: [hrEmployeeDocuments.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrEmployeeDocuments.employeeId], references: [hrEmployees.id] }),
}));

export const hrEmergencyContactsRelations = relations(hrEmergencyContacts, ({ one }) => ({
  organisation: one(organisations, { fields: [hrEmergencyContacts.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrEmergencyContacts.employeeId], references: [hrEmployees.id] }),
}));

export const hrJobOpeningsRelations = relations(hrJobOpenings, ({ one, many }) => ({
  organisation: one(organisations, { fields: [hrJobOpenings.orgId], references: [organisations.id] }),
  department: one(hrDepartments, { fields: [hrJobOpenings.departmentId], references: [hrDepartments.id] }),
  designation: one(hrDesignations, { fields: [hrJobOpenings.designationId], references: [hrDesignations.id] }),
  applications: many(hrCandidateApplications),
}));

export const hrCandidatesRelations = relations(hrCandidates, ({ one, many }) => ({
  organisation: one(organisations, { fields: [hrCandidates.orgId], references: [organisations.id] }),
  applications: many(hrCandidateApplications),
}));

export const hrCandidateApplicationsRelations = relations(hrCandidateApplications, ({ one }) => ({
  organisation: one(organisations, { fields: [hrCandidateApplications.orgId], references: [organisations.id] }),
  candidate: one(hrCandidates, { fields: [hrCandidateApplications.candidateId], references: [hrCandidates.id] }),
  jobOpening: one(hrJobOpenings, { fields: [hrCandidateApplications.jobOpeningId], references: [hrJobOpenings.id] }),
}));

export const hrOnboardingTasksRelations = relations(hrOnboardingTasks, ({ one }) => ({
  organisation: one(organisations, { fields: [hrOnboardingTasks.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrOnboardingTasks.employeeId], references: [hrEmployees.id] }),
}));

export const hrLeaveTypesRelations = relations(hrLeaveTypes, ({ one, many }) => ({
  organisation: one(organisations, { fields: [hrLeaveTypes.orgId], references: [organisations.id] }),
  requests: many(hrLeaveRequests),
  balances: many(hrLeaveBalances),
}));

export const hrLeaveRequestsRelations = relations(hrLeaveRequests, ({ one }) => ({
  organisation: one(organisations, { fields: [hrLeaveRequests.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrLeaveRequests.employeeId], references: [hrEmployees.id] }),
  leaveType: one(hrLeaveTypes, { fields: [hrLeaveRequests.leaveTypeId], references: [hrLeaveTypes.id] }),
  approver: one(hrEmployees, { fields: [hrLeaveRequests.approvedBy], references: [hrEmployees.id], relationName: 'leaveApprover' }),
}));

export const hrLeaveBalancesRelations = relations(hrLeaveBalances, ({ one }) => ({
  organisation: one(organisations, { fields: [hrLeaveBalances.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrLeaveBalances.employeeId], references: [hrEmployees.id] }),
  leaveType: one(hrLeaveTypes, { fields: [hrLeaveBalances.leaveTypeId], references: [hrLeaveTypes.id] }),
}));

export const hrAttendanceRecordsRelations = relations(hrAttendanceRecords, ({ one }) => ({
  organisation: one(organisations, { fields: [hrAttendanceRecords.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrAttendanceRecords.employeeId], references: [hrEmployees.id] }),
}));

export const hrShiftsRelations = relations(hrShifts, ({ one }) => ({
  organisation: one(organisations, { fields: [hrShifts.orgId], references: [organisations.id] }),
}));

export const hrTimesheetsRelations = relations(hrTimesheets, ({ one, many }) => ({
  organisation: one(organisations, { fields: [hrTimesheets.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrTimesheets.employeeId], references: [hrEmployees.id] }),
  entries: many(hrTimesheetEntries),
}));

export const hrTimesheetEntriesRelations = relations(hrTimesheetEntries, ({ one }) => ({
  organisation: one(organisations, { fields: [hrTimesheetEntries.orgId], references: [organisations.id] }),
  timesheet: one(hrTimesheets, { fields: [hrTimesheetEntries.timesheetId], references: [hrTimesheets.id] }),
}));

export const hrPerformanceReviewsRelations = relations(hrPerformanceReviews, ({ one }) => ({
  organisation: one(organisations, { fields: [hrPerformanceReviews.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrPerformanceReviews.employeeId], references: [hrEmployees.id] }),
  reviewer: one(users, { fields: [hrPerformanceReviews.reviewerId], references: [users.id] }),
}));

export const hrCoursesRelations = relations(hrCourses, ({ one, many }) => ({
  organisation: one(organisations, { fields: [hrCourses.orgId], references: [organisations.id] }),
  creator: one(users, { fields: [hrCourses.createdBy], references: [users.id] }),
  enrollments: many(hrEnrollments),
}));

export const hrEnrollmentsRelations = relations(hrEnrollments, ({ one }) => ({
  organisation: one(organisations, { fields: [hrEnrollments.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrEnrollments.employeeId], references: [hrEmployees.id] }),
  course: one(hrCourses, { fields: [hrEnrollments.courseId], references: [hrCourses.id] }),
}));

export const hrPulseSurveysRelations = relations(hrPulseSurveys, ({ one, many }) => ({
  organisation: one(organisations, { fields: [hrPulseSurveys.orgId], references: [organisations.id] }),
  creator: one(users, { fields: [hrPulseSurveys.createdBy], references: [users.id] }),
  responses: many(hrSurveyResponses),
}));

export const hrSurveyResponsesRelations = relations(hrSurveyResponses, ({ one }) => ({
  organisation: one(organisations, { fields: [hrSurveyResponses.orgId], references: [organisations.id] }),
  survey: one(hrPulseSurveys, { fields: [hrSurveyResponses.surveyId], references: [hrPulseSurveys.id] }),
  employee: one(hrEmployees, { fields: [hrSurveyResponses.employeeId], references: [hrEmployees.id] }),
}));

export const hrAnnouncementsRelations = relations(hrAnnouncements, ({ one }) => ({
  organisation: one(organisations, { fields: [hrAnnouncements.orgId], references: [organisations.id] }),
  author: one(users, { fields: [hrAnnouncements.authorId], references: [users.id] }),
}));

export const hrRecognitionRelations = relations(hrRecognition, ({ one }) => ({
  organisation: one(organisations, { fields: [hrRecognition.orgId], references: [organisations.id] }),
  giver: one(hrEmployees, { fields: [hrRecognition.giverId], references: [hrEmployees.id], relationName: 'recognitionGiven' }),
  receiver: one(hrEmployees, { fields: [hrRecognition.receiverId], references: [hrEmployees.id], relationName: 'recognitionReceived' }),
}));

export const hrLetterTemplatesRelations = relations(hrLetterTemplates, ({ one, many }) => ({
  organisation: one(organisations, { fields: [hrLetterTemplates.orgId], references: [organisations.id] }),
  letters: many(hrLetters),
}));

export const hrLettersRelations = relations(hrLetters, ({ one }) => ({
  organisation: one(organisations, { fields: [hrLetters.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrLetters.employeeId], references: [hrEmployees.id] }),
  template: one(hrLetterTemplates, { fields: [hrLetters.templateId], references: [hrLetterTemplates.id] }),
  generator: one(users, { fields: [hrLetters.generatedBy], references: [users.id] }),
  signer: one(users, { fields: [hrLetters.signedBy], references: [users.id], relationName: 'letterSigner' }),
}));

export const hrTravelRequestsRelations = relations(hrTravelRequests, ({ one }) => ({
  organisation: one(organisations, { fields: [hrTravelRequests.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrTravelRequests.employeeId], references: [hrEmployees.id] }),
  approver: one(hrEmployees, { fields: [hrTravelRequests.approvedBy], references: [hrEmployees.id], relationName: 'travelApprover' }),
}));

export const hrExpenseReportsRelations = relations(hrExpenseReports, ({ one, many }) => ({
  organisation: one(organisations, { fields: [hrExpenseReports.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrExpenseReports.employeeId], references: [hrEmployees.id] }),
  entries: many(hrExpenseEntries),
  travelRequest: one(hrTravelRequests, { fields: [hrExpenseReports.travelRequestId], references: [hrTravelRequests.id] }),
}));

export const hrExpenseEntriesRelations = relations(hrExpenseEntries, ({ one }) => ({
  organisation: one(organisations, { fields: [hrExpenseEntries.orgId], references: [organisations.id] }),
  report: one(hrExpenseReports, { fields: [hrExpenseEntries.reportId], references: [hrExpenseReports.id] }),
}));

export const hrCompensationBandsRelations = relations(hrCompensationBands, ({ one }) => ({
  organisation: one(organisations, { fields: [hrCompensationBands.orgId], references: [organisations.id] }),
  designation: one(hrDesignations, { fields: [hrCompensationBands.designationId], references: [hrDesignations.id] }),
}));

export const hrEmployeeCompensationRelations = relations(hrEmployeeCompensation, ({ one }) => ({
  organisation: one(organisations, { fields: [hrEmployeeCompensation.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrEmployeeCompensation.employeeId], references: [hrEmployees.id] }),
}));

export const hrBenefitsRelations = relations(hrBenefits, ({ one, many }) => ({
  organisation: one(organisations, { fields: [hrBenefits.orgId], references: [organisations.id] }),
  employeeBenefits: many(hrEmployeeBenefits),
}));

export const hrEmployeeBenefitsRelations = relations(hrEmployeeBenefits, ({ one }) => ({
  organisation: one(organisations, { fields: [hrEmployeeBenefits.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrEmployeeBenefits.employeeId], references: [hrEmployees.id] }),
  benefit: one(hrBenefits, { fields: [hrEmployeeBenefits.benefitId], references: [hrBenefits.id] }),
}));

export const hrTasksRelations = relations(hrTasks, ({ one }) => ({
  organisation: one(organisations, { fields: [hrTasks.orgId], references: [organisations.id] }),
  assignee: one(hrEmployees, { fields: [hrTasks.assignedTo], references: [hrEmployees.id] }),
  assigner: one(users, { fields: [hrTasks.assignedBy], references: [users.id] }),
}));

export const hrWorkflowTemplatesRelations = relations(hrWorkflowTemplates, ({ one }) => ({
  organisation: one(organisations, { fields: [hrWorkflowTemplates.orgId], references: [organisations.id] }),
}));

export const hrGoalCyclesRelations = relations(hrGoalCycles, ({ one, many }) => ({
  organisation: one(organisations, { fields: [hrGoalCycles.orgId], references: [organisations.id] }),
  okrs: many(hrOkrs),
}));

export const hrOkrsRelations = relations(hrOkrs, ({ one, many }) => ({
  organisation: one(organisations, { fields: [hrOkrs.orgId], references: [organisations.id] }),
  cycle: one(hrGoalCycles, { fields: [hrOkrs.cycleId], references: [hrGoalCycles.id] }),
  owner: one(hrEmployees, { fields: [hrOkrs.ownerId], references: [hrEmployees.id] }),
  keyResults: many(hrKeyResults),
}));

export const hrKeyResultsRelations = relations(hrKeyResults, ({ one }) => ({
  organisation: one(organisations, { fields: [hrKeyResults.orgId], references: [organisations.id] }),
  okr: one(hrOkrs, { fields: [hrKeyResults.okrId], references: [hrOkrs.id] }),
}));

export const hrOffboardingTasksRelations = relations(hrOffboardingTasks, ({ one }) => ({
  organisation: one(organisations, { fields: [hrOffboardingTasks.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrOffboardingTasks.employeeId], references: [hrEmployees.id] }),
}));

export const hrExitInterviewsRelations = relations(hrExitInterviews, ({ one }) => ({
  organisation: one(organisations, { fields: [hrExitInterviews.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrExitInterviews.employeeId], references: [hrEmployees.id] }),
  interviewer: one(users, { fields: [hrExitInterviews.conductedBy], references: [users.id] }),
}));

export const hrHelpTicketsRelations = relations(hrHelpTickets, ({ one, many }) => ({
  organisation: one(organisations, { fields: [hrHelpTickets.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrHelpTickets.employeeId], references: [hrEmployees.id] }),
  responses: many(hrTicketResponses),
}));

export const hrTicketResponsesRelations = relations(hrTicketResponses, ({ one }) => ({
  organisation: one(organisations, { fields: [hrTicketResponses.orgId], references: [organisations.id] }),
  ticket: one(hrHelpTickets, { fields: [hrTicketResponses.ticketId], references: [hrHelpTickets.id] }),
  employee: one(hrEmployees, { fields: [hrTicketResponses.employeeId], references: [hrEmployees.id] }),
}));

export const hrApprovalConfigsRelations = relations(hrApprovalConfigs, ({ one }) => ({
  organisation: one(organisations, { fields: [hrApprovalConfigs.orgId], references: [organisations.id] }),
}));

export const hrApprovalRequestsRelations = relations(hrApprovalRequests, ({ one, many }) => ({
  organisation: one(organisations, { fields: [hrApprovalRequests.orgId], references: [organisations.id] }),
  requester: one(hrEmployees, { fields: [hrApprovalRequests.requesterId], references: [hrEmployees.id], relationName: 'approvalsRequested' }),
  approver: one(hrEmployees, { fields: [hrApprovalRequests.approverId], references: [hrEmployees.id], relationName: 'approvalsApproved' }),
  escalatedToEmployee: one(hrEmployees, { fields: [hrApprovalRequests.escalatedTo], references: [hrEmployees.id], relationName: 'approvalsEscalated' }),
  delegatedToEmployee: one(hrEmployees, { fields: [hrApprovalRequests.delegatedTo], references: [hrEmployees.id], relationName: 'approvalsDelegated' }),
  stepInstances: many(hrApprovalStepInstances),
  comments: many(hrApprovalComments),
}));

export const hrApprovalStepInstancesRelations = relations(hrApprovalStepInstances, ({ one, many }) => ({
  request: one(hrApprovalRequests, { fields: [hrApprovalStepInstances.requestId], references: [hrApprovalRequests.id] }),
  assignee: one(hrEmployees, { fields: [hrApprovalStepInstances.assigneeId], references: [hrEmployees.id] }),
  comments: many(hrApprovalComments),
}));

export const hrApprovalDelegationsRelations = relations(hrApprovalDelegations, ({ one }) => ({
  organisation: one(organisations, { fields: [hrApprovalDelegations.orgId], references: [organisations.id] }),
  delegator: one(hrEmployees, { fields: [hrApprovalDelegations.delegatorId], references: [hrEmployees.id], relationName: 'delegationsGiven' }),
  delegate: one(hrEmployees, { fields: [hrApprovalDelegations.delegateId], references: [hrEmployees.id], relationName: 'delegationsReceived' }),
}));

export const hrApprovalEscalationRulesRelations = relations(hrApprovalEscalationRules, ({ one }) => ({
  organisation: one(organisations, { fields: [hrApprovalEscalationRules.orgId], references: [organisations.id] }),
  escalateTo: one(hrEmployees, { fields: [hrApprovalEscalationRules.escalateToUserId], references: [hrEmployees.id] }),
}));

export const hrApprovalCommentsRelations = relations(hrApprovalComments, ({ one }) => ({
  request: one(hrApprovalRequests, { fields: [hrApprovalComments.requestId], references: [hrApprovalRequests.id] }),
  stepInstance: one(hrApprovalStepInstances, { fields: [hrApprovalComments.stepInstanceId], references: [hrApprovalStepInstances.id] }),
  user: one(hrEmployees, { fields: [hrApprovalComments.userId], references: [hrEmployees.id] }),
}));

export const hrSettingsRelations = relations(hrSettings, ({ one }) => ({
  organisation: one(organisations, { fields: [hrSettings.orgId], references: [organisations.id] }),
}));

export const hrPoliciesRelations = relations(hrPolicies, ({ one }) => ({
  organisation: one(organisations, { fields: [hrPolicies.orgId], references: [organisations.id] }),
  creator: one(users, { fields: [hrPolicies.createdBy], references: [users.id] }),
}));

export const hrTravelAdvancesRelations = relations(hrTravelAdvances, ({ one }) => ({
  organisation: one(organisations, { fields: [hrTravelAdvances.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrTravelAdvances.employeeId], references: [hrEmployees.id] }),
  travelRequest: one(hrTravelRequests, { fields: [hrTravelAdvances.travelRequestId], references: [hrTravelRequests.id] }),
}));

export const hrTravelSettlementsRelations = relations(hrTravelSettlements, ({ one }) => ({
  organisation: one(organisations, { fields: [hrTravelSettlements.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrTravelSettlements.employeeId], references: [hrEmployees.id] }),
  travelRequest: one(hrTravelRequests, { fields: [hrTravelSettlements.travelRequestId], references: [hrTravelRequests.id] }),
}));

export const hrDocCategoriesRelations = relations(hrDocCategories, ({ one, many }) => ({
  organisation: one(organisations, { fields: [hrDocCategories.orgId], references: [organisations.id] }),
  parent: one(hrDocCategories, { fields: [hrDocCategories.parentId], references: [hrDocCategories.id], relationName: 'docCatParent' }),
  children: many(hrDocCategories, { relationName: 'docCatParent' }),
  files: many(hrDocFiles),
}));

export const hrDocFilesRelations = relations(hrDocFiles, ({ one, many }) => ({
  organisation: one(organisations, { fields: [hrDocFiles.orgId], references: [organisations.id] }),
  category: one(hrDocCategories, { fields: [hrDocFiles.categoryId], references: [hrDocCategories.id] }),
  uploader: one(users, { fields: [hrDocFiles.uploadedBy], references: [users.id] }),
  versions: many(hrDocVersions),
  permissions: many(hrDocPermissions),
  employeeLinks: many(hrDocEmployeeLinks),
}));

export const hrDocVersionsRelations = relations(hrDocVersions, ({ one }) => ({
  organisation: one(organisations, { fields: [hrDocVersions.orgId], references: [organisations.id] }),
  file: one(hrDocFiles, { fields: [hrDocVersions.fileId], references: [hrDocFiles.id] }),
  uploader: one(users, { fields: [hrDocVersions.uploadedBy], references: [users.id] }),
}));

export const hrDocPermissionsRelations = relations(hrDocPermissions, ({ one }) => ({
  organisation: one(organisations, { fields: [hrDocPermissions.orgId], references: [organisations.id] }),
  file: one(hrDocFiles, { fields: [hrDocPermissions.fileId], references: [hrDocFiles.id] }),
  employee: one(hrEmployees, { fields: [hrDocPermissions.employeeId], references: [hrEmployees.id] }),
  granter: one(users, { fields: [hrDocPermissions.grantedBy], references: [users.id] }),
}));

export const hrDocEmployeeLinksRelations = relations(hrDocEmployeeLinks, ({ one }) => ({
  organisation: one(organisations, { fields: [hrDocEmployeeLinks.orgId], references: [organisations.id] }),
  file: one(hrDocFiles, { fields: [hrDocEmployeeLinks.fileId], references: [hrDocFiles.id] }),
  employee: one(hrEmployees, { fields: [hrDocEmployeeLinks.employeeId], references: [hrEmployees.id] }),
}));

export const hrWorkflowInstancesRelations = relations(hrWorkflowInstances, ({ one }) => ({
  organisation: one(organisations, { fields: [hrWorkflowInstances.orgId], references: [organisations.id] }),
  template: one(hrWorkflowTemplates, { fields: [hrWorkflowInstances.templateId], references: [hrWorkflowTemplates.id] }),
}));

export const hrAutomationRulesRelations = relations(hrAutomationRules, ({ one }) => ({
  organisation: one(organisations, { fields: [hrAutomationRules.orgId], references: [organisations.id] }),
  template: one(hrWorkflowTemplates, { fields: [hrAutomationRules.templateId], references: [hrWorkflowTemplates.id] }),
}));

export const hrNotificationsRelations = relations(hrNotifications, ({ one }) => ({
  organisation: one(organisations, { fields: [hrNotifications.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrNotifications.employeeId], references: [hrEmployees.id] }),
}));

export const hrReminderConfigsRelations = relations(hrReminderConfigs, ({ one }) => ({
  organisation: one(organisations, { fields: [hrReminderConfigs.orgId], references: [organisations.id] }),
  template: one(hrWorkflowTemplates, { fields: [hrReminderConfigs.templateId], references: [hrWorkflowTemplates.id] }),
}));

export const hrPolicyAcknowledgementsRelations = relations(hrPolicyAcknowledgements, ({ one }) => ({
  organisation: one(organisations, { fields: [hrPolicyAcknowledgements.orgId], references: [organisations.id] }),
  policy: one(hrPolicies, { fields: [hrPolicyAcknowledgements.policyId], references: [hrPolicies.id] }),
  employee: one(hrEmployees, { fields: [hrPolicyAcknowledgements.employeeId], references: [hrEmployees.id] }),
}));

export const hrDocumentRequestsRelations = relations(hrDocumentRequests, ({ one }) => ({
  organisation: one(organisations, { fields: [hrDocumentRequests.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrDocumentRequests.employeeId], references: [hrEmployees.id] }),
  requester: one(users, { fields: [hrDocumentRequests.requestedBy], references: [users.id] }),
}));

export const hrRenewalTrackingRelations = relations(hrRenewalTracking, ({ one }) => ({
  organisation: one(organisations, { fields: [hrRenewalTracking.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrRenewalTracking.employeeId], references: [hrEmployees.id] }),
}));

export const hrCalendarEventsRelations = relations(hrCalendarEvents, ({ one }) => ({
  organisation: one(organisations, { fields: [hrCalendarEvents.orgId], references: [organisations.id] }),
  employee: one(hrEmployees, { fields: [hrCalendarEvents.employeeId], references: [hrEmployees.id] }),
}));
