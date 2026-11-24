' ==========================================================
'  CASH YOU | كاش يو  -  MainWindow.xaml.vb
'  منطق شاشة «فاتورة بيع سريع» بالكامل
'  الدعم الفني : م / وائل الجمال - 01222355769
' ==========================================================

Imports System.Collections.ObjectModel
Imports System.Globalization
Imports System.Printing
Imports System.Windows
Imports System.Windows.Controls
Imports System.Windows.Documents
Imports System.Windows.Input
Imports System.Windows.Media
Imports System.Windows.Threading
Imports CashYou.Data
Imports CashYou.Models

Namespace Global.CashYou

    Public Class MainWindow

        Private Const PAGE_SIZE As Integer = 24

        Private _products As New List(Of Product)
        Private _categories As New List(Of Category)
        Private _customers As New List(Of Customer)
        Private ReadOnly _lines As New ObservableCollection(Of InvoiceLine)

        Private _filtered As New List(Of Product)
        Private _pageIndex As Integer = 0
        Private _categoryId As Integer = -1          ' -1 = الكل
        Private _saleType As String = "نقدي"
        Private _discountPercent As Double = 0
        Private _clock As DispatcherTimer

        ' =====================================================
        '  بدء التشغيل
        ' =====================================================
        Public Sub New()
            InitializeComponent()
            Database.Initialize()
            DatabaseExtended.EnsureExtendedSchema()
            LoadMasters()
            GridItems.ItemsSource = _lines
            BuildCategoryButtons()
            ApplyFilter()
            StartClock()
            NewInvoice()
            AddHandler Me.KeyDown, AddressOf MainWindow_KeyDown
            AddHandler Me.Loaded, Sub() TxtBarcode.Focus()
        End Sub

        Private Sub LoadMasters()
            _categories = Database.GetCategories()
            _products = Database.GetProducts()
            _customers = Database.GetCustomers()

            CmbCustomer.ItemsSource = _customers
            CmbCustomer.DisplayMemberPath = NameOf(Customer.Name)
            CmbCustomer.SelectedIndex = 0

            CmbPayment.ItemsSource = Database.GetPaymentMethods()
            CmbPayment.DisplayMemberPath = NameOf(PaymentMethod.Name)
            CmbPayment.SelectedIndex = 0
        End Sub

        Private Sub StartClock()
            _clock = New DispatcherTimer With {.Interval = TimeSpan.FromSeconds(1)}
            AddHandler _clock.Tick, Sub() UpdateClock()
            _clock.Start()
            UpdateClock()
        End Sub

        Private Sub UpdateClock()
            Dim ar = New CultureInfo("ar-EG")
            Dim now = DateTime.Now
            LblDate.Text = now.ToString("dddd d MMMM yyyy", ar)
            LblTime.Text = now.ToString("hh:mm:ss tt", ar)
            LblFooterClock.Text = now.ToString("dddd d MMMM yyyy — hh:mm:ss tt", ar)
        End Sub

        ' =====================================================
        '  شريط التصنيفات
        ' =====================================================
        Private Sub BuildCategoryButtons()
            PnlCategories.Children.Clear()
            PnlCategories.Children.Add(MakeCategoryChip("الكل", -1))
            For Each c In _categories
                PnlCategories.Children.Add(MakeCategoryChip(c.Name, c.Id))
            Next
            RefreshCategoryChips()
        End Sub

        Private Function MakeCategoryChip(text As String, id As Integer) As Button
            Dim b As New Button With {
                .Content = text,
                .Tag = id,
                .Height = 30,
                .Margin = New Thickness(0, 0, 6, 0),
                .Padding = New Thickness(14, 0, 14, 0),
                .Style = CType(FindResource("FlatButton"), Style)
            }
            AddHandler b.Click, Sub(sender As Object, e As RoutedEventArgs)
                                    _categoryId = CInt(DirectCast(sender, Button).Tag)
                                    _pageIndex = 0
                                    RefreshCategoryChips()
                                    ApplyFilter()
                                End Sub
            Return b
        End Function

        Private Sub RefreshCategoryChips()
            For Each child In PnlCategories.Children
                Dim b = TryCast(child, Button)
                If b Is Nothing Then Continue For
                Dim active = CInt(b.Tag) = _categoryId
                b.Background = New SolidColorBrush(
                    CType(ColorConverter.ConvertFrom(If(active, "#FF1E293B", "#FFFFFFFF")), Color))
                b.Foreground = New SolidColorBrush(
                    CType(ColorConverter.ConvertFrom(If(active, "#FFFFFFFF", "#FF334155")), Color))
            Next
        End Sub

        ' =====================================================
        '  شبكة اللمس + الترقيم
        ' =====================================================
        Private Sub ApplyFilter()
            Dim term = If(TxtItemSearch.Text, String.Empty).Trim()
            _filtered = _products.Where(
                Function(p) (_categoryId = -1 OrElse p.CategoryId = _categoryId) AndAlso
                            (term = String.Empty OrElse p.Name.Contains(term) OrElse p.Code.Contains(term))
            ).ToList()

            Dim pages = Math.Max(1, CInt(Math.Ceiling(_filtered.Count / CDbl(PAGE_SIZE))))
            If _pageIndex >= pages Then _pageIndex = pages - 1
            If _pageIndex < 0 Then _pageIndex = 0

            ItemsTouch.ItemsSource = _filtered.Skip(_pageIndex * PAGE_SIZE).Take(PAGE_SIZE).ToList()
            LblPageInfo.Text = $"{_pageIndex + 1} / {pages} - {_filtered.Count} صنف"
            BtnPrevPage.IsEnabled = _pageIndex > 0
            BtnNextPage.IsEnabled = _pageIndex < pages - 1
        End Sub

        Private Sub BtnPrevPage_Click(sender As Object, e As RoutedEventArgs)
            _pageIndex -= 1
            ApplyFilter()
        End Sub

        Private Sub BtnNextPage_Click(sender As Object, e As RoutedEventArgs)
            _pageIndex += 1
            ApplyFilter()
        End Sub

        Private Sub TxtItemSearch_TextChanged(sender As Object, e As TextChangedEventArgs)
            _pageIndex = 0
            If IsLoaded Then ApplyFilter()
        End Sub

        Private Sub TouchItem_Click(sender As Object, e As RoutedEventArgs)
            Dim p = TryCast(DirectCast(sender, Button).Tag, Product)
            If p IsNot Nothing Then AddProduct(p)
        End Sub

        ' =====================================================
        '  إضافة الأصناف
        ' =====================================================
        Private Sub AddProduct(p As Product, Optional qty As Double = 1)
            Dim existing = _lines.FirstOrDefault(Function(l) l.ProductId = p.Id)
            If existing IsNot Nothing Then
                existing.Qty += qty
            Else
                _lines.Add(New InvoiceLine With {
                    .ProductId = p.Id, .Code = p.Code, .Name = p.Name,
                    .Unit = p.Unit, .Price = p.Price, .Qty = qty, .Discount = 0})
            End If
            System.Media.SystemSounds.Beep.Play()
            Recalculate()
            GridItems.ScrollIntoView(_lines.Last())
            If p.Stock <= 0 Then
                MessageBox.Show($"تنبيه: رصيد الصنف «{p.Name}» نفد من المخزون",
                                "كاش يو", MessageBoxButton.OK, MessageBoxImage.Warning)
            End If
        End Sub

        Private Sub TxtBarcode_KeyDown(sender As Object, e As KeyEventArgs)
            If e.Key <> Key.Enter Then Return
            Dim code = If(TxtBarcode.Text, String.Empty).Trim()
            TxtBarcode.Clear()
            If code = String.Empty Then Return

            Dim p = Database.FindProductByCode(code)
            If p Is Nothing Then
                System.Media.SystemSounds.Hand.Play()
                MessageBox.Show($"لا يوجد صنف بالكود «{code}»", "كاش يو",
                                MessageBoxButton.OK, MessageBoxImage.Exclamation)
                Return
            End If
            AddProduct(p)
        End Sub

        Private Sub BtnDeleteLine_Click(sender As Object, e As RoutedEventArgs)
            Dim line = TryCast(DirectCast(sender, Button).DataContext, InvoiceLine)
            If line Is Nothing Then Return
            If MessageBox.Show($"هل تريد حذف «{line.Name}» من الفاتورة؟", "تأكيد الحذف",
                               MessageBoxButton.YesNo, MessageBoxImage.Question) = MessageBoxResult.Yes Then
                _lines.Remove(line)
                Recalculate()
            End If
        End Sub

        Private Sub GridItems_CellEditEnding(sender As Object, e As DataGridCellEditEndingEventArgs)
            Dispatcher.BeginInvoke(New Action(AddressOf Recalculate), DispatcherPriority.Background)
        End Sub

        ' =====================================================
        '  الحسابات المالية
        ' =====================================================
        Private Sub Recalculate()
            Dim subTotal = Math.Round(_lines.Sum(Function(l) l.Total), 2)
            Dim discountValue = Math.Round(subTotal * _discountPercent / 100.0, 2)
            Dim net = Math.Round(subTotal - discountValue, 2)

            Dim paid As Double
            Double.TryParse(If(TxtPaid.Text, "0"), paid)

            Dim remaining = Math.Round(net - paid, 2)

            LblNet.Text = net.ToString("N2")
            LblRemainingTitle.Text = If(remaining < 0, "الباقي للزبون", "المتبقي")
            LblRemaining.Text = Math.Abs(remaining).ToString("N2")
            LblRemaining.Foreground = New SolidColorBrush(
                CType(ColorConverter.ConvertFrom(If(remaining > 0, "#FFEF4444", "#FF047857")), Color))

            Dim cust = TryCast(CmbCustomer.SelectedItem, Customer)
            Dim prevBal = If(cust Is Nothing, 0, cust.Balance)
            LblPrevBalance.Text = $"الرصيد السابق: {prevBal:N2}"
            LblAfterBalance.Text = $"الرصيد بعد الفاتورة: {(prevBal + remaining):N2}"
        End Sub

        Private Sub TxtPaid_TextChanged(sender As Object, e As TextChangedEventArgs)
            If IsLoaded Then Recalculate()
        End Sub

        Private Sub TxtDiscountPercent_TextChanged(sender As Object, e As TextChangedEventArgs)
            Double.TryParse(If(TxtDiscountPercent.Text, "0"), _discountPercent)
            _discountPercent = Math.Min(100, Math.Max(0, _discountPercent))
            If IsLoaded Then Recalculate()
        End Sub

        ' =====================================================
        '  مفاتيح الوظائف
        ' =====================================================
        Private Sub MainWindow_KeyDown(sender As Object, e As KeyEventArgs)
            Select Case e.Key
                Case Key.F3
                    TxtBarcode.Focus() : TxtBarcode.SelectAll() : e.Handled = True
                Case Key.F4
                    NewInvoice() : e.Handled = True
                Case Key.F5
                    SaveInvoice(False) : e.Handled = True
                Case Key.F10
                    SaveInvoice(True) : e.Handled = True
                Case Key.F11
                    ShowDiscountDialog() : e.Handled = True
                Case Key.F12
                    PayFull() : e.Handled = True
            End Select
        End Sub

        Private Sub BtnFocusBarcode_Click(sender As Object, e As RoutedEventArgs)
            TxtBarcode.Focus() : TxtBarcode.SelectAll()
        End Sub

        Private Sub BtnNewInvoice_Click(sender As Object, e As RoutedEventArgs)
            NewInvoice()
        End Sub

        Private Sub NewInvoice()
            _lines.Clear()
            _discountPercent = 0
            TxtDiscountPercent.Text = "0"
            TxtPaid.Text = "0"
            CmbCustomer.SelectedIndex = 0
            LblInvoiceNo.Text = Database.NextInvoiceNumber().ToString()
            Recalculate()
            TxtBarcode.Focus()
        End Sub

        Private Sub BtnPayFull_Click(sender As Object, e As RoutedEventArgs)
            PayFull()
        End Sub

        Private Sub PayFull()
            If _lines.Count = 0 Then
                MessageBox.Show("أضف أصنافاً إلى الفاتورة أولاً", "كاش يو",
                                MessageBoxButton.OK, MessageBoxImage.Information)
                Return
            End If
            Dim subTotal = Math.Round(_lines.Sum(Function(l) l.Total), 2)
            TxtPaid.Text = Math.Round(subTotal - (subTotal * _discountPercent / 100.0), 2).ToString("0.00")
            Recalculate()
        End Sub

        Private Sub BtnDiscount_Click(sender As Object, e As RoutedEventArgs)
            ShowDiscountDialog()
        End Sub

        Private Sub ShowDiscountDialog()
            Dim dlg As New DiscountWindow With {.Owner = Me, CurrentPercent = _discountPercent}
            If dlg.ShowDialog() = True Then
                _discountPercent = dlg.CurrentPercent
                TxtDiscountPercent.Text = _discountPercent.ToString("0.##")
                Recalculate()
            End If
        End Sub

        Private Sub BtnSave_Click(sender As Object, e As RoutedEventArgs)
            SaveInvoice(False)
        End Sub

        Private Sub BtnSavePrint_Click(sender As Object, e As RoutedEventArgs)
            SaveInvoice(True)
        End Sub

        Private Sub SaveInvoice(print As Boolean)
            If _lines.Count = 0 Then
                System.Media.SystemSounds.Hand.Play()
                MessageBox.Show("لا يمكن حفظ فاتورة بدون أصناف", "كاش يو",
                                MessageBoxButton.OK, MessageBoxImage.Exclamation)
                Return
            End If

            Dim cust = TryCast(CmbCustomer.SelectedItem, Customer)
            Dim pm = TryCast(CmbPayment.SelectedItem, PaymentMethod)
            Dim subTotal = Math.Round(_lines.Sum(Function(l) l.Total), 2)
            Dim discountValue = Math.Round(subTotal * _discountPercent / 100.0, 2)
            Dim net = Math.Round(subTotal - discountValue, 2)
            Dim paid As Double
            Double.TryParse(If(TxtPaid.Text, "0"), paid)

            Dim installmentDlg As InstallmentPlanWindow = Nothing
            If _saleType = "تقسيط" Then
                If cust Is Nothing OrElse cust.Name = "عميل نقدي" Then
                    MessageBox.Show("اختر عميلاً محدداً قبل البيع بالتقسيط", "كاش يو",
                                    MessageBoxButton.OK, MessageBoxImage.Warning)
                    Return
                End If
                installmentDlg = New InstallmentPlanWindow(net) With {.Owner = Me}
                If installmentDlg.ShowDialog() <> True Then Return
                paid = installmentDlg.DownPayment
                TxtPaid.Text = paid.ToString("0.00")
            End If

            Dim inv As New Invoice With {
                .CustomerId = If(cust Is Nothing, CType(Nothing, Integer?), cust.Id),
                .CustomerName = If(cust Is Nothing, "عميل نقدي", cust.Name),
                .PaymentMethod = If(pm Is Nothing, "نقدي", pm.Name),
                .SaleType = _saleType,
                .SubTotal = subTotal,
                .DiscountPercent = _discountPercent,
                .DiscountValue = discountValue,
                .Total = net,
                .Paid = paid,
                .Remaining = Math.Round(net - paid, 2),
                .Printed = print
            }

            Dim number = Database.SaveInvoice(inv, _lines)
            If installmentDlg IsNot Nothing AndAlso cust IsNot Nothing Then
                DatabaseExtended.CreateInstallmentPlan(number, cust.Id, cust.Name, net,
                    installmentDlg.DownPayment, installmentDlg.InterestRate, installmentDlg.Months,
                    installmentDlg.FirstDue, installmentDlg.GuarantorName, installmentDlg.GuarantorPhone)
            End If

            If print Then PrintReceipt(inv, number)

            MessageBox.Show($"تم حفظ الفاتورة رقم {number} بمبلغ {net:N2} جنيه",
                            "كاش يو", MessageBoxButton.OK, MessageBoxImage.Information)

            _customers = Database.GetCustomers()
            CmbCustomer.ItemsSource = _customers
            _products = Database.GetProducts()
            ApplyFilter()
            NewInvoice()
        End Sub

        ' =====================================================
        '  الطباعة الحرارية 80 مم
        ' =====================================================
        Private Sub PrintReceipt(inv As Invoice, number As Integer)
            Dim dlg As New PrintDialog()
            If dlg.ShowDialog() <> True Then Return

            Dim doc As New FlowDocument With {
                .PageWidth = 300,
                .FontFamily = New FontFamily("Cairo, Tahoma"),
                .FontSize = 12,
                .FlowDirection = FlowDirection.RightToLeft,
                .PagePadding = New Thickness(8)
            }
            doc.Blocks.Add(New Paragraph(New Run("CASH YOU | كاش يو")) With {
                           .FontWeight = FontWeights.Black, .TextAlignment = TextAlignment.Center})
            doc.Blocks.Add(New Paragraph(New Run(Database.GetSetting("shop_name", ""))) With {
                           .TextAlignment = TextAlignment.Center})
            doc.Blocks.Add(New Paragraph(New Run($"فاتورة رقم : {number}    {DateTime.Now:yyyy/MM/dd HH:mm}")))
            doc.Blocks.Add(New Paragraph(New Run($"العميل : {inv.CustomerName}")))
            doc.Blocks.Add(New Paragraph(New Run($"النوع : {inv.SaleType} / {inv.PaymentMethod}")))

            For Each l In _lines
                doc.Blocks.Add(New Paragraph(
                    New Run($"{l.Name}  ×{l.Qty}  {l.Price:N2}  =  {l.Total:N2}")) With {
                    .Margin = New Thickness(0, 1, 0, 1)})
            Next

            doc.Blocks.Add(New Paragraph(New Run("----------------------------------------")))
            doc.Blocks.Add(New Paragraph(New Run($"الصافي : {inv.Total:N2}")) With {.FontWeight = FontWeights.Black})
            doc.Blocks.Add(New Paragraph(New Run($"المدفوع : {inv.Paid:N2}")))
            doc.Blocks.Add(New Paragraph(New Run($"المتبقي : {inv.Remaining:N2}")))
            doc.Blocks.Add(New Paragraph(New Run("الدعم الفني : م / وائل الجمال   01222355769")) With {
                           .TextAlignment = TextAlignment.Center})

            dlg.PrintDocument(CType(doc, IDocumentPaginatorSource).DocumentPaginator, $"فاتورة {number}")
        End Sub

        ' =====================================================
        '  عناصر الواجهة الأخرى
        ' =====================================================
        Private Sub BtnSaleType_Click(sender As Object, e As RoutedEventArgs)
            _saleType = If(_saleType = "نقدي", "آجل", If(_saleType = "آجل", "تقسيط", "نقدي"))
            BtnSaleType.Content = _saleType
            Dim color = If(_saleType = "نقدي", "#FF10B981", If(_saleType = "آجل", "#FFF97316", "#FF8B5CF6"))
            BtnSaleType.Background = New SolidColorBrush(CType(ColorConverter.ConvertFrom(color), Color))
            If _saleType = "تقسيط" Then
                MessageBox.Show("عند حفظ الفاتورة ستظهر شاشة المقدم ونسبة الربح وعدد الأقساط وبيانات الضامن",
                                "بيع بالتقسيط", MessageBoxButton.OK, MessageBoxImage.Information)
            End If
        End Sub

        Private Sub BtnModules_Click(sender As Object, e As RoutedEventArgs)
            Dim target = DirectCast(sender, Button).Tag.ToString()
            Dim modules As New ModulesWindow(target) With {.Owner = Me}
            modules.Show()
        End Sub

        Private Sub BtnCustomerScreen_Click(sender As Object, e As RoutedEventArgs)
            Dim w As New CustomerDisplayWindow(_lines, LblNet.Text, TxtPaid.Text, LblRemaining.Text)
            w.Show()
        End Sub

        Private Sub BtnAddCustomer_Click(sender As Object, e As RoutedEventArgs)
            Dim name = Microsoft.VisualBasic.Interaction.InputBox("اسم العميل الجديد:", "إضافة عميل", "")
            If String.IsNullOrWhiteSpace(name) Then Return
            Dim phone = Microsoft.VisualBasic.Interaction.InputBox("رقم التليفون:", "إضافة عميل", "")
            Dim c = Database.AddCustomer(name.Trim(), phone.Trim(), 0)
            _customers.Add(c)
            CmbCustomer.ItemsSource = Nothing
            CmbCustomer.ItemsSource = _customers
            CmbCustomer.SelectedItem = c
        End Sub

        Private Sub BtnAddPayment_Click(sender As Object, e As RoutedEventArgs)
            Dim name = Microsoft.VisualBasic.Interaction.InputBox("اسم طريقة الدفع:", "إضافة طريقة دفع", "")
            If String.IsNullOrWhiteSpace(name) Then Return
            Dim method = Database.AddPaymentMethod(name.Trim())
            CmbPayment.ItemsSource = Database.GetPaymentMethods()
            CmbPayment.SelectedIndex = CmbPayment.Items.Count - 1
            MessageBox.Show($"تمت إضافة طريقة الدفع «{method.Name}»", "كاش يو")
        End Sub

        Private Sub TxtGlobalSearch_TextChanged(sender As Object, e As TextChangedEventArgs)
            ' بحث عام بسيط : يفلتر شبكة اللمس مباشرة
            If Not IsLoaded Then Return
            TxtItemSearch.Text = TxtGlobalSearch.Text
        End Sub

        Private Sub Header_MouseLeftButtonDown(sender As Object, e As MouseButtonEventArgs)
            If e.ClickCount = 2 Then
                BtnMax_Click(sender, e)
            ElseIf WindowState = WindowState.Normal Then
                DragMove()
            End If
        End Sub

        Private Sub BtnMin_Click(sender As Object, e As RoutedEventArgs)
            WindowState = WindowState.Minimized
        End Sub

        Private Sub BtnMax_Click(sender As Object, e As RoutedEventArgs)
            WindowState = If(WindowState = WindowState.Maximized, WindowState.Normal, WindowState.Maximized)
        End Sub

        Private Sub BtnClose_Click(sender As Object, e As RoutedEventArgs)
            Dim dirty = _lines.Count > 0
            Dim msg = If(dirty,
                         "الفاتورة الحالية تحتوي على أصناف غير محفوظة. هل تريد إغلاق النظام؟",
                         "هل تريد إغلاق نظام كاش يو؟")
            If MessageBox.Show(msg, "إنهاء الجلسة", MessageBoxButton.YesNo,
                               MessageBoxImage.Question) = MessageBoxResult.Yes Then
                Application.Current.Shutdown()
            End If
        End Sub

    End Class

    ' =========================================================
    '  نافذة الخصم (F11)
    ' =========================================================
    Public Class DiscountWindow
        Inherits Window

        Public Property CurrentPercent As Double

        Private ReadOnly _txt As New TextBox With {
            .FontSize = 26, .FontWeight = FontWeights.Black, .Height = 52,
            .TextAlignment = TextAlignment.Center, .Margin = New Thickness(0, 12, 0, 12)}

        Public Sub New()
            Title = "خصم على الفاتورة"
            Width = 380 : Height = 250
            WindowStartupLocation = WindowStartupLocation.CenterOwner
            FlowDirection = FlowDirection.RightToLeft
            FontFamily = New FontFamily("Cairo, Tahoma")
            ResizeMode = ResizeMode.NoResize
            Background = New SolidColorBrush(Colors.White)

            Dim root As New StackPanel With {.Margin = New Thickness(16)}
            root.Children.Add(New TextBlock With {
                .Text = "اكتب نسبة الخصم المئوية ثم اضغط تطبيق",
                .FontSize = 13, .FontWeight = FontWeights.Bold})
            root.Children.Add(_txt)

            Dim quick As New WrapPanel()
            For Each p In {0, 5, 10, 15, 20, 25, 50}
                Dim b As New Button With {.Content = $"{p}%", .Width = 54, .Height = 30,
                                          .Margin = New Thickness(3), .Tag = p}
                AddHandler b.Click, Sub(s As Object, e As RoutedEventArgs)
                                        _txt.Text = CInt(DirectCast(s, Button).Tag).ToString()
                                    End Sub
                quick.Children.Add(b)
            Next
            root.Children.Add(quick)

            Dim ok As New Button With {.Content = "تطبيق الخصم", .Height = 42,
                                       .Margin = New Thickness(0, 12, 0, 0),
                                       .Background = New SolidColorBrush(
                                           CType(ColorConverter.ConvertFrom("#FFEF4444"), Color)),
                                       .Foreground = Brushes.White, .FontWeight = FontWeights.Black}
            AddHandler ok.Click, Sub()
                                     Dim v As Double
                                     Double.TryParse(_txt.Text, v)
                                     CurrentPercent = Math.Min(100, Math.Max(0, v))
                                     DialogResult = True
                                 End Sub
            root.Children.Add(ok)
            Content = root
            AddHandler Loaded, Sub() _txt.Text = CurrentPercent.ToString("0.##")
        End Sub
    End Class

    ' =========================================================
    '  شاشة الزبون (العرض الثاني)
    ' =========================================================
    Public Class CustomerDisplayWindow
        Inherits Window

        Public Sub New(lines As IEnumerable(Of InvoiceLine),
                       net As String, paid As String, remaining As String)

            Title = "شاشة الزبون - كاش يو"
            WindowState = WindowState.Maximized
            FlowDirection = FlowDirection.RightToLeft
            FontFamily = New FontFamily("Cairo, Tahoma")
            Background = New SolidColorBrush(CType(ColorConverter.ConvertFrom("#FF0F172A"), Color))

            Dim root As New Grid()
            root.RowDefinitions.Add(New RowDefinition With {.Height = New GridLength(1, GridUnitType.Star)})
            root.RowDefinitions.Add(New RowDefinition With {.Height = New GridLength(150)})

            Dim list As New ItemsControl With {
                .ItemsSource = lines.ToList(),
                .Margin = New Thickness(24),
                .Foreground = Brushes.White,
                .FontSize = 22}
            ScrollViewer.SetVerticalScrollBarVisibility(list, ScrollBarVisibility.Auto)
            Grid.SetRow(list, 0)
            root.Children.Add(list)

            Dim bar As New UniformGrid With {.Columns = 3, .Margin = New Thickness(24, 0, 24, 24)}
            bar.Children.Add(MakeCard("الإجمالي المستحق", net, "#FFF59E0B"))
            bar.Children.Add(MakeCard("المدفوع", paid, "#FF10B981"))
            bar.Children.Add(MakeCard("المتبقي", remaining, "#FF22D3EE"))
            Grid.SetRow(bar, 1)
            root.Children.Add(bar)

            Content = root

            AddHandler KeyDown, Sub(s As Object, e As KeyEventArgs)
                                    If e.Key = Key.Escape Then Close()
                                End Sub
        End Sub

        Private Shared Function MakeCard(title As String, value As String, hex As String) As Border
            Dim sp As New StackPanel With {.Margin = New Thickness(14)}
            sp.Children.Add(New TextBlock With {
                .Text = title, .FontSize = 15, .FontWeight = FontWeights.Bold,
                .Foreground = New SolidColorBrush(
                    CType(ColorConverter.ConvertFrom("#FF94A3B8"), Color))})
            sp.Children.Add(New TextBlock With {
                .Text = value, .FontSize = 40, .FontWeight = FontWeights.Black,
                .Foreground = New SolidColorBrush(CType(ColorConverter.ConvertFrom(hex), Color))})
            Return New Border With {
                .CornerRadius = New CornerRadius(16),
                .Margin = New Thickness(6, 0, 6, 0),
                .Background = New SolidColorBrush(CType(ColorConverter.ConvertFrom("#14FFFFFF"), Color)),
                .Child = sp}
        End Function
    End Class

End Namespace