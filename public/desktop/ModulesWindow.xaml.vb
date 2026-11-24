' ==========================================================
'  CASH YOU | كاش يو  -  ModulesWindow.xaml.vb
'  منطق وحدات الإدارة المتصلة مباشرة بقاعدة SQLite
' ==========================================================

Imports System.Collections.ObjectModel
Imports System.Data
Imports System.Globalization
Imports System.Windows
Imports System.Windows.Controls
Imports System.Windows.Documents
Imports System.Windows.Input
Imports System.Windows.Media
Imports CashYou.Data
Imports CashYou.Models

Namespace Global.CashYou

    Public Class ModulesWindow

        Private _products As New List(Of Product)
        Private ReadOnly _tradeLines As New ObservableCollection(Of InvoiceLine)
        Private _tradeMode As String = "purchase"
        Private _productId As Integer = 0
        Private _partyId As Integer = 0
        Private _isCustomer As Boolean = True
        Private _productsTable As DataTable

        Public Sub New(Optional startModule As String = "dashboard")
            InitializeComponent()
            Database.Initialize()
            DatabaseExtended.EnsureExtendedSchema()
            GrdTrade.ItemsSource = _tradeLines
            CmbPCategory.ItemsSource = Database.GetCategories()
            CmbPUnit.SelectedIndex = 0
            CmbExpenseCategory.SelectedIndex = 0
            Navigate(startModule)
            RefreshProducts()
            LoadDashboard()
        End Sub

        Private Sub ShowOnly(view As UIElement)
            Dim views As UIElement() = {ViewDashboard, ViewProducts, ViewTrade, ViewParties,
                                        ViewInstallments, ViewExpenses, ViewTreasury, ViewReports}
            For Each v As UIElement In views
                v.Visibility = If(v Is view, Visibility.Visible, Visibility.Collapsed)
            Next
        End Sub

        Private Sub Nav_Click(sender As Object, e As RoutedEventArgs)
            Navigate(DirectCast(sender, Button).Tag.ToString())
        End Sub

        Public Sub Navigate(moduleName As String)
            Select Case moduleName
                Case "invoice"
                    Dim w As New MainWindow()
                    w.Show()
                    Close()
                    Return
                Case "products"
                    ShowOnly(ViewProducts) : LblModuleTitle.Text = "الأصناف والمخازن" : RefreshProducts()
                Case "purchase", "salesReturn", "purchaseReturn"
                    _tradeMode = moduleName
                    ShowOnly(ViewTrade)
                    LblModuleTitle.Text = If(moduleName = "purchase", "فاتورة مشتريات",
                                          If(moduleName = "salesReturn", "مرتجع مبيعات", "مرتجع مشتريات"))
                    PrepareTrade()
                Case "parties"
                    ShowOnly(ViewParties) : LblModuleTitle.Text = "العملاء والموردون" : LoadParties()
                Case "installments"
                    ShowOnly(ViewInstallments) : LblModuleTitle.Text = "نظام التقسيط وتحصيل الأقساط" : LoadInstallments()
                Case "expenses"
                    ShowOnly(ViewExpenses) : LblModuleTitle.Text = "المصروفات اليومية" : LoadExpenses()
                Case "treasury"
                    ShowOnly(ViewTreasury) : LblModuleTitle.Text = "حركة الخزينة وإغلاق الوردية" : LoadTreasury()
                Case "reports"
                    ShowOnly(ViewReports) : LblModuleTitle.Text = "التقارير والأرباح" : LoadReports()
                Case Else
                    ShowOnly(ViewDashboard) : LblModuleTitle.Text = "الرئيسية" : LoadDashboard()
            End Select
        End Sub

        ' =====================================================
        '  الرئيسية والتقارير
        ' =====================================================
        Private Sub LoadDashboard()
            KpiSales.Text = Sum("Invoices", "Total", True).ToString("N2")
            KpiPurchases.Text = Sum("Purchases", "Total", True).ToString("N2")
            KpiExpenses.Text = Sum("Expenses", "Amount", True).ToString("N2")
            KpiCash.Text = DatabaseExtended.TreasuryBalance().ToString("N2")
            GrdRecent.ItemsSource = DatabaseExtended.Query(
                "SELECT Number,CustomerName,Total,Paid,Remaining FROM Invoices ORDER BY Id DESC LIMIT 12").DefaultView
        End Sub

        Private Function Sum(table As String, column As String, todayOnly As Boolean) As Double
            Dim where = If(todayOnly, " WHERE date(CreatedAt)=date('now','localtime')", "")
            Dim t = DatabaseExtended.Query($"SELECT IFNULL(SUM({column}),0) AS Value FROM {table}{where}")
            Return Convert.ToDouble(t.Rows(0)("Value"))
        End Function

        Private Sub LoadReports()
            Dim sales = Sum("Invoices", "Total", False)
            Dim purchases = Sum("Purchases", "Total", False)
            Dim expenses = Sum("Expenses", "Amount", False)
            RptSales.Text = sales.ToString("N2")
            RptPurchases.Text = purchases.ToString("N2")
            RptExpenses.Text = expenses.ToString("N2")
            RptNet.Text = (sales - purchases - expenses).ToString("N2")
            GrdReport.ItemsSource = DatabaseExtended.Query(
                "SELECT Number AS 'الفاتورة',CustomerName AS 'العميل',SaleType AS 'النوع',
                        Total AS 'الإجمالي',Paid AS 'المدفوع',Remaining AS 'المتبقي',CreatedAt AS 'التاريخ'
                 FROM Invoices ORDER BY Id DESC").DefaultView
        End Sub

        ' =====================================================
        '  الأصناف والمخازن
        ' =====================================================
        Private Sub RefreshProducts()
            _products = Database.GetProducts()
            _productsTable = DatabaseExtended.Query(
                "SELECT Id,Code,Name,CategoryId,Unit,Cost,Price,WholesalePrice,Stock,MinStockLimit FROM Products ORDER BY SortOrder")
            GrdProducts.ItemsSource = _productsTable.DefaultView
            If Not String.IsNullOrWhiteSpace(TxtProductSearch.Text) Then ProductSearch_TextChanged(Nothing, Nothing)
        End Sub

        Private Sub ProductSearch_TextChanged(sender As Object, e As TextChangedEventArgs)
            If _productsTable Is Nothing Then Return
            Dim term = If(TxtProductSearch.Text, "").Replace("'", "''").Trim()
            _productsTable.DefaultView.RowFilter =
                If(term = "", "", $"Name LIKE '%{term}%' OR Code LIKE '%{term}%'")
        End Sub

        Private Sub GrdProducts_LoadingRow(sender As Object, e As DataGridRowEventArgs)
            Dim row = TryCast(e.Row.Item, DataRowView)
            If row Is Nothing Then Return
            Dim low = Convert.ToDouble(row("Stock")) <= Convert.ToDouble(row("MinStockLimit"))
            e.Row.Background = New SolidColorBrush(CType(ColorConverter.ConvertFrom(If(low, "#FFFECACA", "#FFFFFFFF")), Color))
            e.Row.Foreground = New SolidColorBrush(CType(ColorConverter.ConvertFrom(If(low, "#FF991B1B", "#FF1E293B")), Color))
        End Sub

        Private Sub GrdProducts_SelectionChanged(sender As Object, e As SelectionChangedEventArgs)
            Dim row = TryCast(GrdProducts.SelectedItem, DataRowView)
            If row Is Nothing Then Return
            _productId = Convert.ToInt32(row("Id"))
            TxtPCode.Text = row("Code").ToString()
            TxtPName.Text = row("Name").ToString()
            CmbPCategory.SelectedValue = Convert.ToInt32(row("CategoryId"))
            CmbPUnit.Text = row("Unit").ToString()
            TxtPBuy.Text = Convert.ToDouble(row("Cost")).ToString("0.##")
            TxtPRetail.Text = Convert.ToDouble(row("Price")).ToString("0.##")
            TxtPWholesale.Text = Convert.ToDouble(row("WholesalePrice")).ToString("0.##")
            TxtPStock.Text = Convert.ToDouble(row("Stock")).ToString("0.##")
            TxtPMin.Text = Convert.ToDouble(row("MinStockLimit")).ToString("0.##")
        End Sub

        Private Sub GenerateBarcode_Click(sender As Object, e As RoutedEventArgs)
            TxtPCode.Text = "62" & DateTime.Now.ToString("yyMMddHHmmss")
        End Sub

        Private Sub ClearProduct_Click(sender As Object, e As RoutedEventArgs)
            _productId = 0
            For Each t In {TxtPCode, TxtPName, TxtPBuy, TxtPRetail, TxtPWholesale, TxtPStock}
                t.Clear()
            Next
            TxtPBuy.Text = "0" : TxtPRetail.Text = "0" : TxtPWholesale.Text = "0" : TxtPStock.Text = "0"
            TxtPMin.Text = "5"
            GrdProducts.SelectedItem = Nothing
            TxtPCode.Focus()
        End Sub

        Private Sub SaveProduct_Click(sender As Object, e As RoutedEventArgs)
            Try
                If String.IsNullOrWhiteSpace(TxtPName.Text) Then Throw New InvalidOperationException("اسم الصنف مطلوب")
                If String.IsNullOrWhiteSpace(TxtPCode.Text) Then Throw New InvalidOperationException("الباركود مطلوب")
                DatabaseExtended.SaveProduct(_productId, TxtPCode.Text.Trim(), TxtPName.Text.Trim(),
                    Convert.ToInt32(If(CmbPCategory.SelectedValue, 1)), CmbPUnit.Text,
                    Number(TxtPBuy.Text), Number(TxtPRetail.Text), Number(TxtPWholesale.Text),
                    Number(TxtPStock.Text), Number(TxtPMin.Text))
                RefreshProducts()
                ClearProduct_Click(Nothing, Nothing)
                MessageBox.Show("تم حفظ الصنف وتحديث المخزن", "كاش يو", MessageBoxButton.OK, MessageBoxImage.Information)
            Catch ex As Exception
                MessageBox.Show(ex.Message, "تعذر حفظ الصنف", MessageBoxButton.OK, MessageBoxImage.Warning)
            End Try
        End Sub

        Private Sub DeleteProduct_Click(sender As Object, e As RoutedEventArgs)
            Dim row = TryCast(GrdProducts.SelectedItem, DataRowView)
            If row Is Nothing Then MessageBox.Show("اختر صنفاً أولاً") : Return
            If MessageBox.Show($"حذف الصنف «{row("Name")}» نهائياً؟", "تأكيد", MessageBoxButton.YesNo,
                               MessageBoxImage.Question) <> MessageBoxResult.Yes Then Return
            DatabaseExtended.DeleteProduct(Convert.ToInt32(row("Id")))
            ClearProduct_Click(Nothing, Nothing)
            RefreshProducts()
        End Sub

        ' =====================================================
        '  المشتريات والمرتجعات
        ' =====================================================
        Private Sub PrepareTrade()
            _tradeLines.Clear()
            _products = Database.GetProducts()
            Dim isSales = _tradeMode = "salesReturn"
            LblTradeParty.Text = If(isSales, "العميل", "المورد")
            LblTradeCash.Text = If(_tradeMode = "purchase", "المدفوع للمورد",
                                If(isSales, "المسترد نقداً للعميل", "المسترد نقداً من المورد"))
            BtnSaveTrade.Content = If(_tradeMode = "purchase", "حفظ فاتورة المشتريات",
                                   If(isSales, "حفظ مرتجع المبيعات", "حفظ مرتجع المشتريات"))
            TxtTradeReference.IsEnabled = _tradeMode <> "purchase"
            TxtTradeDiscount.Text = "0"
            TxtTradeNotes.Clear()
            TxtTradePaid.Text = "0"
            If isSales Then
                CmbTradeParty.ItemsSource = Database.GetCustomers()
            Else
                CmbTradeParty.ItemsSource = DatabaseExtended.Query("SELECT Id,Name,Balance FROM Suppliers ORDER BY Id").DefaultView
            End If
            CmbTradeParty.SelectedIndex = 0
            FilterTradeItems()
            RecalculateTrade()
        End Sub

        Private Sub FilterTradeItems()
            Dim term = If(TxtTradeSearch.Text, "").Trim()
            ItemsTrade.ItemsSource = _products.Where(Function(p) term = "" OrElse p.Name.Contains(term) OrElse p.Code.Contains(term)).Take(24).ToList()
        End Sub

        Private Sub TradeSearch_TextChanged(sender As Object, e As TextChangedEventArgs)
            If IsLoaded AndAlso _products IsNot Nothing Then FilterTradeItems()
        End Sub

        Private Sub TradeTouch_Click(sender As Object, e As RoutedEventArgs)
            AddTradeProduct(TryCast(DirectCast(sender, Button).Tag, Product))
        End Sub

        Private Sub TradeBarcode_KeyDown(sender As Object, e As KeyEventArgs)
            If e.Key <> Key.Enter Then Return
            Dim code = TxtTradeBarcode.Text.Trim()
            TxtTradeBarcode.Clear()
            Dim p = _products.FirstOrDefault(Function(x) x.Code = code OrElse x.Code.EndsWith(code))
            If p Is Nothing Then MessageBox.Show("لا يوجد صنف بهذا الباركود", "كاش يو") : Return
            AddTradeProduct(p)
        End Sub

        Private Sub AddTradeProduct(p As Product)
            If p Is Nothing Then Return
            Dim found = _tradeLines.FirstOrDefault(Function(l) l.ProductId = p.Id)
            If found IsNot Nothing Then
                found.Qty += 1
            Else
                _tradeLines.Add(New InvoiceLine With {
                    .ProductId = p.Id, .Code = p.Code, .Name = p.Name, .Unit = p.Unit,
                    .Price = If(_tradeMode = "salesReturn", p.Price, p.Cost), .Qty = 1})
            End If
            RecalculateTrade()
        End Sub

        Private Sub DeleteTradeLine_Click(sender As Object, e As RoutedEventArgs)
            Dim line = TryCast(DirectCast(sender, Button).DataContext, InvoiceLine)
            If line IsNot Nothing Then _tradeLines.Remove(line)
            RecalculateTrade()
        End Sub

        Private Sub GrdTrade_CellEditEnding(sender As Object, e As DataGridCellEditEndingEventArgs)
            Dispatcher.BeginInvoke(New Action(AddressOf RecalculateTrade))
        End Sub

        Private Sub TradePaid_TextChanged(sender As Object, e As TextChangedEventArgs)
            If IsLoaded Then RecalculateTrade()
        End Sub

        Private Sub TradeDiscount_TextChanged(sender As Object, e As TextChangedEventArgs)
            If IsLoaded Then RecalculateTrade()
        End Sub

        Private Sub RecalculateTrade()
            Dim total = DatabaseExtended.NetTotal(_tradeLines.ToList(), Number(TxtTradeDiscount.Text))
            Dim paid = Math.Max(0, Math.Min(total, Number(TxtTradePaid.Text)))
            LblTradeTotal.Text = total.ToString("N2")
            LblTradeRemaining.Text = (total - paid).ToString("N2")
        End Sub

        Private Sub SaveTrade_Click(sender As Object, e As RoutedEventArgs)
            Try
                If CmbTradeParty.SelectedValue Is Nothing Then Throw New InvalidOperationException("اختر الحساب أولاً")
                Dim partyId = Convert.ToInt32(CmbTradeParty.SelectedValue)
                Dim paid = Number(TxtTradePaid.Text)
                Dim discount = Number(TxtTradeDiscount.Text)
                Dim note = If(String.IsNullOrWhiteSpace(TxtTradeNotes.Text), "مستند مخزني", TxtTradeNotes.Text.Trim())
                Dim number As Integer
                If _tradeMode = "purchase" Then
                    number = DatabaseExtended.SavePurchase(partyId, paid, _tradeLines.ToList(), note, discount)
                Else
                    Dim refNo As Integer? = Nothing
                    Dim parsed As Integer
                    If Integer.TryParse(TxtTradeReference.Text, parsed) Then refNo = parsed
                    number = DatabaseExtended.SaveReturn(_tradeMode = "salesReturn", partyId, refNo, paid,
                                                         _tradeLines.ToList(), note, discount)
                End If
                Dim docLines = _tradeLines.Select(Function(l) $"{l.Name} × {l.Qty} = {(l.Qty * l.Price):N2}").ToList()
                If discount > 0 Then docLines.Add($"الخصم : {discount:0.##}%")
                docLines.Add($"البيان : {note}")
                PrintDocument(LblModuleTitle.Text, number.ToString(), docLines, Number(TxtTradePaid.Text))
                _tradeLines.Clear()
                TxtTradePaid.Text = "0" : TxtTradeReference.Clear() : TxtTradeDiscount.Text = "0" : TxtTradeNotes.Clear()
                RefreshProducts()
                RecalculateTrade()
                MessageBox.Show($"تم حفظ المستند رقم {number} وتحديث المخزون والحساب والخزينة", "كاش يو")
            Catch ex As Exception
                MessageBox.Show(ex.Message, "تعذر حفظ المستند", MessageBoxButton.OK, MessageBoxImage.Warning)
            End Try
        End Sub

        ' =====================================================
        '  العملاء والموردون والسندات
        ' =====================================================
        Private Sub PartyKind_Click(sender As Object, e As RoutedEventArgs)
            _isCustomer = DirectCast(sender, Button).Tag.ToString() = "customer"
            BtnSaveVoucher.Content = If(_isCustomer, "حفظ وطباعة سند قبض", "حفظ وطباعة سند صرف")
            ClearParty()
            LoadParties()
        End Sub

        Private Sub LoadParties()
            Dim table = If(_isCustomer, "Customers", "Suppliers")
            GrdParties.ItemsSource = DatabaseExtended.Query(
                $"SELECT Id,Name,Phone,Address,OpeningBalance,Balance FROM {table} ORDER BY Id").DefaultView
        End Sub

        Private Sub ClearParty()
            _partyId = 0
            TxtPartyName.Clear() : TxtPartyPhone.Clear() : TxtPartyAddress.Clear()
            TxtPartyOpening.Text = "0" : TxtPartyBalance.Text = "0"
        End Sub

        Private Sub GrdParties_SelectionChanged(sender As Object, e As SelectionChangedEventArgs)
            Dim row = TryCast(GrdParties.SelectedItem, DataRowView)
            If row Is Nothing Then Return
            _partyId = Convert.ToInt32(row("Id"))
            TxtPartyName.Text = row("Name").ToString()
            TxtPartyPhone.Text = row("Phone").ToString()
            TxtPartyAddress.Text = row("Address").ToString()
            TxtPartyOpening.Text = Convert.ToDouble(row("OpeningBalance")).ToString("0.##")
            TxtPartyBalance.Text = Convert.ToDouble(row("Balance")).ToString("0.##")
            TxtVoucherAmount.Text = Math.Max(0, Convert.ToDouble(row("Balance"))).ToString("0.##")
        End Sub

        Private Sub SaveParty_Click(sender As Object, e As RoutedEventArgs)
            Try
                If String.IsNullOrWhiteSpace(TxtPartyName.Text) Then Throw New InvalidOperationException("الاسم مطلوب")
                DatabaseExtended.SaveParty(_isCustomer, _partyId, TxtPartyName.Text.Trim(), TxtPartyPhone.Text.Trim(),
                    TxtPartyAddress.Text.Trim(), Number(TxtPartyOpening.Text), Number(TxtPartyBalance.Text))
                ClearParty() : LoadParties()
                MessageBox.Show("تم حفظ البيانات والرصيد", "كاش يو")
            Catch ex As Exception
                MessageBox.Show(ex.Message, "كاش يو", MessageBoxButton.OK, MessageBoxImage.Warning)
            End Try
        End Sub

        Private Sub SaveVoucher_Click(sender As Object, e As RoutedEventArgs)
            Try
                If _partyId = 0 Then Throw New InvalidOperationException("اختر الحساب من الجدول أولاً")
                Dim amount = Number(TxtVoucherAmount.Text)
                Dim number = DatabaseExtended.SaveVoucher(_isCustomer, _partyId, amount, TxtVoucherNotes.Text)
                PrintDocument(If(_isCustomer, "سند قبض من عميل", "سند صرف لمورد"), number.ToString(),
                              New List(Of String) From {$"الاسم : {TxtPartyName.Text}", $"البيان : {TxtVoucherNotes.Text}"}, amount)
                LoadParties() : LoadTreasury()
                MessageBox.Show($"تم تسجيل السند {number} وتحديث الرصيد والخزينة", "كاش يو")
            Catch ex As Exception
                MessageBox.Show(ex.Message, "كاش يو", MessageBoxButton.OK, MessageBoxImage.Warning)
            End Try
        End Sub

        ' =====================================================
        '  تحصيل الأقساط
        ' =====================================================
        Private Sub LoadInstallments()
            GrdInstallments.ItemsSource = DatabaseExtended.Query(
                "SELECT Id,PlanId,CustomerName,Sequence,DueDate,Amount,Status,PaidAt FROM Installments ORDER BY DueDate,Sequence").DefaultView
            Dim late = DatabaseExtended.Query("SELECT IFNULL(SUM(Amount),0) V FROM Installments WHERE Status<>'مدفوع' AND DueDate<date('now','localtime')")
            Dim due = DatabaseExtended.Query("SELECT IFNULL(SUM(Amount),0) V FROM Installments WHERE Status<>'مدفوع' AND DueDate=date('now','localtime')")
            Dim paid = DatabaseExtended.Query("SELECT IFNULL(SUM(Amount),0) V FROM Installments WHERE Status='مدفوع'")
            LblLateInstallments.Text = Convert.ToDouble(late.Rows(0)("V")).ToString("N2")
            LblTodayInstallments.Text = Convert.ToDouble(due.Rows(0)("V")).ToString("N2")
            LblCollectedInstallments.Text = Convert.ToDouble(paid.Rows(0)("V")).ToString("N2")
        End Sub

        Private Sub GrdInstallments_LoadingRow(sender As Object, e As DataGridRowEventArgs)
            Dim row = TryCast(e.Row.Item, DataRowView)
            If row Is Nothing Then Return
            Dim status = row("Status").ToString()
            Dim due = DateTime.Parse(row("DueDate").ToString()).Date
            Dim color = If(status = "مدفوع", "#FFD1FAE5", If(due < DateTime.Today, "#FFFECACA", If(due = DateTime.Today, "#FFFEF08A", "#FFFFFFFF")))
            e.Row.Background = New SolidColorBrush(CType(ColorConverter.ConvertFrom(color), Color))
        End Sub

        Private Sub CollectInstallment_Click(sender As Object, e As RoutedEventArgs)
            Try
                Dim id = Convert.ToInt32(DirectCast(sender, Button).Tag)
                Dim row = TryCast(DirectCast(sender, Button).DataContext, DataRowView)
                If row IsNot Nothing AndAlso row("Status").ToString() = "مدفوع" Then Throw New InvalidOperationException("القسط محصل بالفعل")
                DatabaseExtended.CollectInstallment(id)
                If row IsNot Nothing Then
                    PrintDocument("إيصال تحصيل قسط", id.ToString(), New List(Of String) From {
                        $"العميل : {row("CustomerName")}", $"القسط رقم : {row("Sequence")}",
                        $"تاريخ الاستحقاق : {row("DueDate")}"}, Convert.ToDouble(row("Amount")))
                End If
                LoadInstallments()
                MessageBox.Show("تم تحصيل القسط وتسجيله في الخزينة", "كاش يو")
            Catch ex As Exception
                MessageBox.Show(ex.Message, "كاش يو", MessageBoxButton.OK, MessageBoxImage.Warning)
            End Try
        End Sub

        ' =====================================================
        '  المصروفات والخزينة
        ' =====================================================
        Private Sub LoadExpenses()
            GrdExpenses.ItemsSource = DatabaseExtended.Query("SELECT Number,Category,Amount,Notes,CreatedAt FROM Expenses ORDER BY Id DESC").DefaultView
        End Sub

        Private Sub SaveExpense_Click(sender As Object, e As RoutedEventArgs)
            Try
                Dim amount = Number(TxtExpenseAmount.Text)
                Dim category = CmbExpenseCategory.Text
                Dim number = DatabaseExtended.AddExpense(category, amount, TxtExpenseNotes.Text)
                PrintDocument("سند مصروفات", number.ToString(), New List(Of String) From {
                    $"النوع : {category}", $"البيان : {TxtExpenseNotes.Text}"}, amount)
                TxtExpenseAmount.Text = "0" : TxtExpenseNotes.Clear()
                LoadExpenses()
                MessageBox.Show("تم تسجيل المصروف وخصمه من الخزينة", "كاش يو")
            Catch ex As Exception
                MessageBox.Show(ex.Message, "كاش يو", MessageBoxButton.OK, MessageBoxImage.Warning)
            End Try
        End Sub

        Private Sub LoadTreasury()
            GrdTreasury.ItemsSource = DatabaseExtended.Query(
                "SELECT Direction,Source,Reference,PartyName,Amount,CreatedAt FROM TreasuryMovements ORDER BY Id DESC").DefaultView
            LblTreasuryBalance.Text = DatabaseExtended.TreasuryBalance().ToString("N2")
            LblTreasuryIn.Text = SumDirection("وارد").ToString("N2")
            LblTreasuryOut.Text = SumDirection("منصرف").ToString("N2")
        End Sub

        Private Function SumDirection(direction As String) As Double
            Dim t = DatabaseExtended.Query($"SELECT IFNULL(SUM(Amount),0) V FROM TreasuryMovements WHERE Direction='{direction}'")
            Return Convert.ToDouble(t.Rows(0)("V"))
        End Function

        Private Sub CloseShift_Click(sender As Object, e As RoutedEventArgs)
            If MessageBox.Show("سيتم إغلاق الوردية وفتح وردية جديدة بالرصيد الختامي. متابعة؟", "إغلاق الوردية",
                               MessageBoxButton.YesNo, MessageBoxImage.Question) <> MessageBoxResult.Yes Then Return
            Try
                Dim closing = DatabaseExtended.CloseShift("مراجعة درج النقدية")
                PrintDocument("تقرير إغلاق وردية", DateTime.Now.ToString("yyyyMMddHHmm"), New List(Of String) From {
                    $"الوارد : {SumDirection("وارد"):N2}", $"المنصرف : {SumDirection("منصرف"):N2}",
                    "تم ترحيل الرصيد إلى الوردية الجديدة"}, closing)
                LoadTreasury()
                MessageBox.Show($"تم إغلاق الوردية. الرصيد الختامي {closing:N2}", "كاش يو")
            Catch ex As Exception
                MessageBox.Show(ex.Message, "كاش يو", MessageBoxButton.OK, MessageBoxImage.Warning)
            End Try
        End Sub

        ' =====================================================
        '  الطباعة والأدوات
        ' =====================================================
        Private Shared Function Number(text As String) As Double
            Dim n As Double
            Double.TryParse(text, NumberStyles.Any, CultureInfo.InvariantCulture, n)
            Return n
        End Function

        Private Shared Sub PrintDocument(title As String, number As String, lines As List(Of String), amount As Double)
            Dim dlg As New PrintDialog()
            If dlg.ShowDialog() <> True Then Return
            Dim doc As New FlowDocument With {.PageWidth = 300, .FlowDirection = FlowDirection.RightToLeft,
                                              .FontFamily = New FontFamily("Cairo, Tahoma"), .FontSize = 12}
            doc.Blocks.Add(New Paragraph(New Run("CASH YOU | كاش يو")) With {.FontWeight = FontWeights.Black, .TextAlignment = TextAlignment.Center})
            doc.Blocks.Add(New Paragraph(New Run($"{title} — مستند {number}")) With {.FontWeight = FontWeights.Bold})
            doc.Blocks.Add(New Paragraph(New Run(DateTime.Now.ToString("yyyy/MM/dd HH:mm"))))
            For Each line In lines
                doc.Blocks.Add(New Paragraph(New Run(line)) With {.Margin = New Thickness(0, 1, 0, 1)})
            Next
            doc.Blocks.Add(New Paragraph(New Run($"القيمة : {amount:N2} جنيه")) With {.FontSize = 16, .FontWeight = FontWeights.Black})
            doc.Blocks.Add(New Paragraph(New Run("الدعم الفني : م / وائل الجمال — 01222355769")) With {.TextAlignment = TextAlignment.Center})
            dlg.PrintDocument(CType(doc, IDocumentPaginatorSource).DocumentPaginator, title)
        End Sub

        Private Sub Min_Click(sender As Object, e As RoutedEventArgs)
            WindowState = WindowState.Minimized
        End Sub

        Private Sub Close_Click(sender As Object, e As RoutedEventArgs)
            Close()
        End Sub

    End Class

    ' =========================================================
    '  نافذة بيانات التقسيط المنبثقة عند حفظ البيع
    ' =========================================================
    Public Class InstallmentPlanWindow
        Inherits Window

        Public ReadOnly Property DownPayment As Double
            Get Return NumberValue(_down.Text) End Get
        End Property
        Public ReadOnly Property InterestRate As Double
            Get Return NumberValue(_rate.Text) End Get
        End Property
        Public ReadOnly Property Months As Integer
            Get Return Math.Max(1, CInt(NumberValue(_months.Text))) End Get
        End Property
        Public ReadOnly Property FirstDue As DateTime
            Get Return If(_first.SelectedDate, DateTime.Today.AddMonths(1)) End Get
        End Property
        Public ReadOnly Property GuarantorName As String
            Get Return _guarantor.Text End Get
        End Property
        Public ReadOnly Property GuarantorPhone As String
            Get Return _phone.Text End Get
        End Property

        Private ReadOnly _down As New TextBox With {.Height = 36, .FontSize = 18}
        Private ReadOnly _rate As New TextBox With {.Text = "10", .Height = 36}
        Private ReadOnly _months As New TextBox With {.Text = "6", .Height = 36}
        Private ReadOnly _first As New DatePicker With {.SelectedDate = DateTime.Today.AddMonths(1), .Height = 36}
        Private ReadOnly _guarantor As New TextBox With {.Height = 36}
        Private ReadOnly _phone As New TextBox With {.Height = 36}

        Public Sub New(total As Double)
            Title = "إنشاء تعاقد تقسيط"
            Width = 520 : Height = 480
            WindowStartupLocation = WindowStartupLocation.CenterOwner
            FlowDirection = FlowDirection.RightToLeft
            FontFamily = New FontFamily("Cairo, Tahoma")
            ResizeMode = ResizeMode.NoResize
            Dim root As New StackPanel With {.Margin = New Thickness(20)}
            root.Children.Add(New TextBlock With {.Text = $"إجمالي الفاتورة : {total:N2} جنيه", .FontSize = 17, .FontWeight = FontWeights.Black})
            AddField(root, "المقدم", _down)
            AddField(root, "نسبة الربح %", _rate)
            AddField(root, "عدد الأقساط / الشهور", _months)
            AddField(root, "تاريخ أول استحقاق", _first)
            AddField(root, "اسم الضامن", _guarantor)
            AddField(root, "تليفون الضامن", _phone)
            _down.Text = Math.Round(total * 0.2, 2).ToString("0.##")
            Dim save As New Button With {.Content = "حفظ وإنشاء جدول الأقساط", .Height = 44,
                .Background = New SolidColorBrush(CType(ColorConverter.ConvertFrom("#FF7C3AED"), Color)),
                .Foreground = Brushes.White, .FontWeight = FontWeights.Black}
            AddHandler save.Click, Sub()
                                       If DownPayment > total Then
                                           MessageBox.Show("المقدم أكبر من قيمة الفاتورة") : Return
                                       End If
                                       DialogResult = True
                                   End Sub
            root.Children.Add(save)
            Content = root
        End Sub

        Private Shared Sub AddField(root As StackPanel, label As String, field As UIElement)
            root.Children.Add(New TextBlock With {.Text = label, .FontWeight = FontWeights.Bold, .Margin = New Thickness(0, 9, 0, 3)})
            root.Children.Add(field)
        End Sub

        Private Shared Function NumberValue(text As String) As Double
            Dim n As Double
            Double.TryParse(text, n)
            Return n
        End Function
    End Class

End Namespace