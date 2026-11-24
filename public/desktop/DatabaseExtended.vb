' ==========================================================
'  CASH YOU | كاش يو  -  DatabaseExtended.vb
'  المخازن والموردون والمشتريات والمرتجعات والأقساط والخزينة
'  تعمل على نفس ملف cashyou.db ونفس ترميز SQLite
' ==========================================================

Imports System.Data
Imports System.IO
Imports CashYou.Models
Imports Microsoft.Data.Sqlite

Namespace Data

    Public Module DatabaseExtended

        Private ReadOnly DbPath As String =
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "cashyou.db")

        Private Function Open() As SqliteConnection
            Dim c As New SqliteConnection($"Data Source={DbPath};Cache=Shared;Foreign Keys=True")
            c.Open()
            Return c
        End Function

        Private Sub TryAlter(c As SqliteConnection, sql As String)
            Try
                Using cmd = c.CreateCommand()
                    cmd.CommandText = sql
                    cmd.ExecuteNonQuery()
                End Using
            Catch ex As SqliteException When ex.Message.Contains("duplicate column")
                ' العمود موجود من تشغيل سابق
            End Try
        End Sub

        Public Sub EnsureExtendedSchema()
            Using c = Open(), cmd = c.CreateCommand()
                cmd.CommandText = "
CREATE TABLE IF NOT EXISTS Suppliers(
 Id INTEGER PRIMARY KEY AUTOINCREMENT, Name TEXT NOT NULL, Phone TEXT NOT NULL DEFAULT '',
 Address TEXT NOT NULL DEFAULT '', OpeningBalance REAL NOT NULL DEFAULT 0, Balance REAL NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS Purchases(
 Id INTEGER PRIMARY KEY AUTOINCREMENT, Number INTEGER NOT NULL, SupplierId INTEGER NOT NULL,
 SupplierName TEXT NOT NULL, Total REAL NOT NULL, Paid REAL NOT NULL, Remaining REAL NOT NULL,
 Notes TEXT NOT NULL DEFAULT '', CreatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS PurchaseItems(
 Id INTEGER PRIMARY KEY AUTOINCREMENT, PurchaseId INTEGER NOT NULL, ProductId INTEGER NOT NULL,
 Code TEXT NOT NULL, Name TEXT NOT NULL, Unit TEXT NOT NULL, Qty REAL NOT NULL,
 Price REAL NOT NULL, Total REAL NOT NULL);
CREATE TABLE IF NOT EXISTS Returns(
 Id INTEGER PRIMARY KEY AUTOINCREMENT, Number INTEGER NOT NULL, Kind TEXT NOT NULL,
 ReferenceNumber INTEGER NULL, PartyId INTEGER NULL, PartyName TEXT NOT NULL,
 Total REAL NOT NULL, CashAmount REAL NOT NULL, Notes TEXT NOT NULL DEFAULT '', CreatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ReturnItems(
 Id INTEGER PRIMARY KEY AUTOINCREMENT, ReturnId INTEGER NOT NULL, ProductId INTEGER NOT NULL,
 Code TEXT NOT NULL, Name TEXT NOT NULL, Unit TEXT NOT NULL, Qty REAL NOT NULL,
 Price REAL NOT NULL, Total REAL NOT NULL);
CREATE TABLE IF NOT EXISTS Vouchers(
 Id INTEGER PRIMARY KEY AUTOINCREMENT, Number INTEGER NOT NULL, Kind TEXT NOT NULL,
 PartyType TEXT NOT NULL, PartyId INTEGER NOT NULL, PartyName TEXT NOT NULL,
 Amount REAL NOT NULL, Notes TEXT NOT NULL DEFAULT '', CreatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS InstallmentPlans(
 Id INTEGER PRIMARY KEY AUTOINCREMENT, InvoiceNumber INTEGER NOT NULL, CustomerId INTEGER NOT NULL,
 CustomerName TEXT NOT NULL, Principal REAL NOT NULL, DownPayment REAL NOT NULL,
 InterestRate REAL NOT NULL, InterestValue REAL NOT NULL, Months INTEGER NOT NULL,
 MonthlyAmount REAL NOT NULL, FirstDueDate TEXT NOT NULL,
 GuarantorName TEXT NOT NULL DEFAULT '', GuarantorPhone TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS Installments(
 Id INTEGER PRIMARY KEY AUTOINCREMENT, PlanId INTEGER NOT NULL, CustomerId INTEGER NOT NULL,
 CustomerName TEXT NOT NULL, Sequence INTEGER NOT NULL, DueDate TEXT NOT NULL,
 Amount REAL NOT NULL, Status TEXT NOT NULL DEFAULT 'مستحق', PaidAt TEXT NULL);
CREATE TABLE IF NOT EXISTS Expenses(
 Id INTEGER PRIMARY KEY AUTOINCREMENT, Number INTEGER NOT NULL, Category TEXT NOT NULL,
 Amount REAL NOT NULL, Notes TEXT NOT NULL DEFAULT '', CreatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS TreasuryMovements(
 Id INTEGER PRIMARY KEY AUTOINCREMENT, Direction TEXT NOT NULL, Source TEXT NOT NULL,
 Reference TEXT NOT NULL DEFAULT '', PartyName TEXT NOT NULL DEFAULT '',
 Amount REAL NOT NULL, Notes TEXT NOT NULL DEFAULT '', CreatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS Shifts(
 Id INTEGER PRIMARY KEY AUTOINCREMENT, Number INTEGER NOT NULL, OpenedAt TEXT NOT NULL,
 ClosedAt TEXT NULL, OpeningCash REAL NOT NULL DEFAULT 0, ClosingCash REAL NOT NULL DEFAULT 0,
 Sales REAL NOT NULL DEFAULT 0, Purchases REAL NOT NULL DEFAULT 0, Expenses REAL NOT NULL DEFAULT 0,
 Receipts REAL NOT NULL DEFAULT 0, Payments REAL NOT NULL DEFAULT 0,
 Status TEXT NOT NULL DEFAULT 'مفتوحة', Notes TEXT NOT NULL DEFAULT '');"
                cmd.ExecuteNonQuery()
                TryAlter(c, "ALTER TABLE Products ADD COLUMN WholesalePrice REAL NOT NULL DEFAULT 0")
                TryAlter(c, "ALTER TABLE Products ADD COLUMN MinStockLimit REAL NOT NULL DEFAULT 5")
                TryAlter(c, "ALTER TABLE Customers ADD COLUMN Address TEXT NOT NULL DEFAULT ''")
                TryAlter(c, "ALTER TABLE Customers ADD COLUMN OpeningBalance REAL NOT NULL DEFAULT 0")
                Seed(c)
            End Using
        End Sub

        Private Sub Seed(c As SqliteConnection)
            Using cmd = c.CreateCommand()
                cmd.CommandText = "SELECT COUNT(*) FROM Suppliers"
                If Convert.ToInt32(cmd.ExecuteScalar()) > 0 Then Return
                cmd.CommandText = "
INSERT INTO Suppliers(Name,Phone,Address,OpeningBalance,Balance) VALUES
('شركة المتحدة للورق','01023456781','القاهرة - العتبة',1800,1800),
('مكتب النيل للتوريدات','01145678902','طنطا - شارع الجلاء',0,0),
('الدلتا لأدوات الكمبيوتر','01234509876','المنصورة - الجمهورية',750,750);
INSERT INTO Settings(Key,Value) VALUES('next_purchase','7001') ON CONFLICT(Key) DO NOTHING;
INSERT INTO Settings(Key,Value) VALUES('next_return','9001') ON CONFLICT(Key) DO NOTHING;
INSERT INTO Settings(Key,Value) VALUES('next_voucher','3001') ON CONFLICT(Key) DO NOTHING;
INSERT INTO Settings(Key,Value) VALUES('next_expense','1001') ON CONFLICT(Key) DO NOTHING;
INSERT INTO TreasuryMovements(Direction,Source,Reference,PartyName,Amount,Notes,CreatedAt)
SELECT 'وارد','رصيد افتتاحي','خزينة-1','الخزينة الرئيسية',5000,'رصيد بداية التشغيل',datetime('now')
WHERE NOT EXISTS(SELECT 1 FROM TreasuryMovements WHERE Reference='خزينة-1');
INSERT INTO Shifts(Number,OpenedAt,OpeningCash,Status)
SELECT 1,datetime('now'),5000,'مفتوحة' WHERE NOT EXISTS(SELECT 1 FROM Shifts);"
                cmd.ExecuteNonQuery()
            End Using
        End Sub

        Public Function Query(sql As String) As DataTable
            Dim table As New DataTable With {.Locale = Globalization.CultureInfo.GetCultureInfo("ar-EG")}
            Using c = Open(), cmd = c.CreateCommand()
                cmd.CommandText = sql
                Using r = cmd.ExecuteReader()
                    For i = 0 To r.FieldCount - 1
                        table.Columns.Add(r.GetName(i), GetType(Object))
                    Next
                    While r.Read()
                        Dim values(r.FieldCount - 1) As Object
                        r.GetValues(values)
                        table.Rows.Add(values)
                    End While
                End Using
            End Using
            Return table
        End Function

        Private Function NextNumber(c As SqliteConnection, tx As SqliteTransaction, key As String, fallback As Integer) As Integer
            Using cmd = c.CreateCommand()
                cmd.Transaction = tx
                cmd.CommandText = "SELECT Value FROM Settings WHERE Key=$k"
                cmd.Parameters.AddWithValue("$k", key)
                Dim value = cmd.ExecuteScalar()
                Dim number As Integer
                If value Is Nothing OrElse Not Integer.TryParse(value.ToString(), number) Then number = fallback
                cmd.Parameters.Clear()
                cmd.CommandText = "INSERT INTO Settings(Key,Value) VALUES($k,$v) ON CONFLICT(Key) DO UPDATE SET Value=$v"
                cmd.Parameters.AddWithValue("$k", key)
                cmd.Parameters.AddWithValue("$v", (number + 1).ToString())
                cmd.ExecuteNonQuery()
                Return number
            End Using
        End Function

        Private Sub Cash(c As SqliteConnection, tx As SqliteTransaction, direction As String,
                         source As String, reference As String, party As String, amount As Double, notes As String)
            If amount <= 0 Then Return
            Using cmd = c.CreateCommand()
                cmd.Transaction = tx
                cmd.CommandText = "INSERT INTO TreasuryMovements(Direction,Source,Reference,PartyName,Amount,Notes,CreatedAt)
                                   VALUES($d,$s,$r,$p,$a,$n,datetime('now','localtime'))"
                cmd.Parameters.AddWithValue("$d", direction)
                cmd.Parameters.AddWithValue("$s", source)
                cmd.Parameters.AddWithValue("$r", reference)
                cmd.Parameters.AddWithValue("$p", party)
                cmd.Parameters.AddWithValue("$a", amount)
                cmd.Parameters.AddWithValue("$n", notes)
                cmd.ExecuteNonQuery()
            End Using
        End Sub

        Public Sub SaveProduct(id As Integer, code As String, name As String, categoryId As Integer,
                               unit As String, buy As Double, retail As Double, wholesale As Double,
                               stock As Double, minimum As Double)
            Using c = Open(), cmd = c.CreateCommand()
                cmd.CommandText = If(id = 0,
                    "INSERT INTO Products(Code,Name,CategoryId,Unit,Price,Cost,WholesalePrice,Stock,MinStockLimit,SortOrder)
                     VALUES($code,$name,$cat,$unit,$retail,$buy,$whole,$stock,$min,(SELECT IFNULL(MAX(SortOrder),0)+1 FROM Products))",
                    "UPDATE Products SET Code=$code,Name=$name,CategoryId=$cat,Unit=$unit,Price=$retail,Cost=$buy,
                     WholesalePrice=$whole,Stock=$stock,MinStockLimit=$min WHERE Id=$id")
                cmd.Parameters.AddWithValue("$id", id)
                cmd.Parameters.AddWithValue("$code", code)
                cmd.Parameters.AddWithValue("$name", name)
                cmd.Parameters.AddWithValue("$cat", categoryId)
                cmd.Parameters.AddWithValue("$unit", unit)
                cmd.Parameters.AddWithValue("$retail", retail)
                cmd.Parameters.AddWithValue("$buy", buy)
                cmd.Parameters.AddWithValue("$whole", wholesale)
                cmd.Parameters.AddWithValue("$stock", stock)
                cmd.Parameters.AddWithValue("$min", minimum)
                cmd.ExecuteNonQuery()
            End Using
        End Sub

        Public Sub DeleteProduct(id As Integer)
            Using c = Open(), cmd = c.CreateCommand()
                cmd.CommandText = "DELETE FROM Products WHERE Id=$id"
                cmd.Parameters.AddWithValue("$id", id)
                cmd.ExecuteNonQuery()
            End Using
        End Sub

        Public Sub SaveParty(isCustomer As Boolean, id As Integer, name As String, phone As String,
                             address As String, opening As Double, balance As Double)
            Dim table = If(isCustomer, "Customers", "Suppliers")
            Using c = Open(), cmd = c.CreateCommand()
                cmd.CommandText = If(id = 0,
                    $"INSERT INTO {table}(Name,Phone,Address,OpeningBalance,Balance) VALUES($n,$p,$a,$o,$b)",
                    $"UPDATE {table} SET Name=$n,Phone=$p,Address=$a,OpeningBalance=$o,Balance=$b WHERE Id=$id")
                cmd.Parameters.AddWithValue("$id", id)
                cmd.Parameters.AddWithValue("$n", name)
                cmd.Parameters.AddWithValue("$p", phone)
                cmd.Parameters.AddWithValue("$a", address)
                cmd.Parameters.AddWithValue("$o", opening)
                cmd.Parameters.AddWithValue("$b", balance)
                cmd.ExecuteNonQuery()
            End Using
        End Sub

        Public Function SavePurchase(supplierId As Integer, paid As Double,
                                     lines As List(Of InvoiceLine), notes As String,
                                     Optional discountPercent As Double = 0) As Integer
            If lines.Count = 0 Then Throw New InvalidOperationException("أضف أصنافاً إلى فاتورة المشتريات")
            Dim total = NetTotal(lines, discountPercent)
            paid = Math.Max(0, Math.Min(total, paid))
            Using c = Open(), tx = c.BeginTransaction()
                Dim number = NextNumber(c, tx, "next_purchase", 7001)
                Dim supplierName = ""
                Using cmd = c.CreateCommand()
                    cmd.Transaction = tx
                    cmd.CommandText = "SELECT Name FROM Suppliers WHERE Id=$id"
                    cmd.Parameters.AddWithValue("$id", supplierId)
                    supplierName = Convert.ToString(cmd.ExecuteScalar())
                    If supplierName = "" Then Throw New InvalidOperationException("اختر مورداً صحيحاً")
                    cmd.Parameters.Clear()
                    cmd.CommandText = "INSERT INTO Purchases(Number,SupplierId,SupplierName,Total,Paid,Remaining,Notes,CreatedAt)
                                       VALUES($n,$sid,$sn,$t,$p,$r,$notes,datetime('now','localtime'));SELECT last_insert_rowid()"
                    cmd.Parameters.AddWithValue("$n", number)
                    cmd.Parameters.AddWithValue("$sid", supplierId)
                    cmd.Parameters.AddWithValue("$sn", supplierName)
                    cmd.Parameters.AddWithValue("$t", total)
                    cmd.Parameters.AddWithValue("$p", paid)
                    cmd.Parameters.AddWithValue("$r", Math.Round(total - paid, 2))
                    cmd.Parameters.AddWithValue("$notes", notes)
                    Dim purchaseId = Convert.ToInt32(cmd.ExecuteScalar())
                    For Each line In lines
                        SaveTradeLine(c, tx, "PurchaseItems", "PurchaseId", purchaseId, line)
                        UpdateStock(c, tx, line.ProductId, line.Qty, line.Price, True)
                    Next
                    UpdateBalance(c, tx, "Suppliers", supplierId, total - paid)
                End Using
                Cash(c, tx, "منصرف", "مشتريات", $"شراء-{number}", supplierName, paid, "مدفوع فاتورة مشتريات")
                tx.Commit()
                Return number
            End Using
        End Function

        ''' <summary>صافي المستند بعد خصم النسبة المئوية</summary>
        Public Function NetTotal(lines As List(Of InvoiceLine), discountPercent As Double) As Double
            Dim subtotal = Math.Round(lines.Sum(Function(l) l.Qty * l.Price), 2)
            Dim pct = Math.Max(0, Math.Min(100, discountPercent))
            Return Math.Round(subtotal - Math.Round(subtotal * pct / 100.0, 2), 2)
        End Function

        Public Function SaveReturn(isSales As Boolean, partyId As Integer, referenceNumber As Integer?,
                                   cashAmount As Double, lines As List(Of InvoiceLine), notes As String,
                                   Optional discountPercent As Double = 0) As Integer
            If lines.Count = 0 Then Throw New InvalidOperationException("أضف أصنافاً إلى المرتجع")
            Dim total = NetTotal(lines, discountPercent)
            cashAmount = Math.Max(0, Math.Min(total, cashAmount))
            Dim table = If(isSales, "Customers", "Suppliers")
            Using c = Open(), tx = c.BeginTransaction()
                Dim number = NextNumber(c, tx, "next_return", 9001)
                Dim partyName = ""
                Using cmd = c.CreateCommand()
                    cmd.Transaction = tx
                    cmd.CommandText = $"SELECT Name FROM {table} WHERE Id=$id"
                    cmd.Parameters.AddWithValue("$id", partyId)
                    partyName = Convert.ToString(cmd.ExecuteScalar())
                    If partyName = "" Then Throw New InvalidOperationException("اختر الحساب الصحيح")
                    cmd.Parameters.Clear()
                    cmd.CommandText = "INSERT INTO Returns(Number,Kind,ReferenceNumber,PartyId,PartyName,Total,CashAmount,Notes,CreatedAt)
                                       VALUES($n,$k,$ref,$pid,$pn,$t,$cash,$notes,datetime('now','localtime'));SELECT last_insert_rowid()"
                    cmd.Parameters.AddWithValue("$n", number)
                    cmd.Parameters.AddWithValue("$k", If(isSales, "مرتجع مبيعات", "مرتجع مشتريات"))
                    cmd.Parameters.AddWithValue("$ref", If(referenceNumber.HasValue, CObj(referenceNumber.Value), DBNull.Value))
                    cmd.Parameters.AddWithValue("$pid", partyId)
                    cmd.Parameters.AddWithValue("$pn", partyName)
                    cmd.Parameters.AddWithValue("$t", total)
                    cmd.Parameters.AddWithValue("$cash", cashAmount)
                    cmd.Parameters.AddWithValue("$notes", notes)
                    Dim returnId = Convert.ToInt32(cmd.ExecuteScalar())
                    For Each line In lines
                        SaveTradeLine(c, tx, "ReturnItems", "ReturnId", returnId, line)
                        UpdateStock(c, tx, line.ProductId, If(isSales, line.Qty, -line.Qty), line.Price, False)
                    Next
                    UpdateBalance(c, tx, table, partyId, -(total - cashAmount))
                End Using
                Cash(c, tx, If(isSales, "منصرف", "وارد"), If(isSales, "مرتجع مبيعات", "مرتجع مشتريات"),
                     $"مرتجع-{number}", partyName, cashAmount, "تسوية نقدية للمرتجع")
                tx.Commit()
                Return number
            End Using
        End Function

        Private Sub SaveTradeLine(c As SqliteConnection, tx As SqliteTransaction, table As String,
                                  parentColumn As String, parentId As Integer, line As InvoiceLine)
            Using cmd = c.CreateCommand()
                cmd.Transaction = tx
                cmd.CommandText = $"INSERT INTO {table}({parentColumn},ProductId,Code,Name,Unit,Qty,Price,Total)
                                    VALUES($parent,$pid,$code,$name,$unit,$qty,$price,$total)"
                cmd.Parameters.AddWithValue("$parent", parentId)
                cmd.Parameters.AddWithValue("$pid", line.ProductId)
                cmd.Parameters.AddWithValue("$code", line.Code)
                cmd.Parameters.AddWithValue("$name", line.Name)
                cmd.Parameters.AddWithValue("$unit", line.Unit)
                cmd.Parameters.AddWithValue("$qty", line.Qty)
                cmd.Parameters.AddWithValue("$price", line.Price)
                cmd.Parameters.AddWithValue("$total", Math.Round(line.Qty * line.Price, 2))
                cmd.ExecuteNonQuery()
            End Using
        End Sub

        Private Sub UpdateStock(c As SqliteConnection, tx As SqliteTransaction, productId As Integer,
                                quantity As Double, buyPrice As Double, updateBuy As Boolean)
            Using cmd = c.CreateCommand()
                cmd.Transaction = tx
                cmd.CommandText = $"UPDATE Products SET Stock=Stock+$q{If(updateBuy, ",Cost=$p", "")} WHERE Id=$id"
                cmd.Parameters.AddWithValue("$q", quantity)
                cmd.Parameters.AddWithValue("$p", buyPrice)
                cmd.Parameters.AddWithValue("$id", productId)
                cmd.ExecuteNonQuery()
            End Using
        End Sub

        Private Sub UpdateBalance(c As SqliteConnection, tx As SqliteTransaction,
                                  table As String, id As Integer, amount As Double)
            Using cmd = c.CreateCommand()
                cmd.Transaction = tx
                cmd.CommandText = $"UPDATE {table} SET Balance=Balance+$a WHERE Id=$id"
                cmd.Parameters.AddWithValue("$a", amount)
                cmd.Parameters.AddWithValue("$id", id)
                cmd.ExecuteNonQuery()
            End Using
        End Sub

        Public Function SaveVoucher(isReceipt As Boolean, partyId As Integer,
                                    amount As Double, notes As String) As Integer
            If amount <= 0 Then Throw New InvalidOperationException("قيمة السند يجب أن تكون أكبر من صفر")
            Dim table = If(isReceipt, "Customers", "Suppliers")
            Using c = Open(), tx = c.BeginTransaction()
                Dim number = NextNumber(c, tx, "next_voucher", 3001)
                Dim partyName = ""
                Using cmd = c.CreateCommand()
                    cmd.Transaction = tx
                    cmd.CommandText = $"SELECT Name FROM {table} WHERE Id=$id"
                    cmd.Parameters.AddWithValue("$id", partyId)
                    partyName = Convert.ToString(cmd.ExecuteScalar())
                    cmd.Parameters.Clear()
                    cmd.CommandText = "INSERT INTO Vouchers(Number,Kind,PartyType,PartyId,PartyName,Amount,Notes,CreatedAt)
                                       VALUES($n,$k,$pt,$pid,$pn,$a,$notes,datetime('now','localtime'))"
                    cmd.Parameters.AddWithValue("$n", number)
                    cmd.Parameters.AddWithValue("$k", If(isReceipt, "سند قبض من عميل", "سند صرف لمورد"))
                    cmd.Parameters.AddWithValue("$pt", If(isReceipt, "عميل", "مورد"))
                    cmd.Parameters.AddWithValue("$pid", partyId)
                    cmd.Parameters.AddWithValue("$pn", partyName)
                    cmd.Parameters.AddWithValue("$a", amount)
                    cmd.Parameters.AddWithValue("$notes", notes)
                    cmd.ExecuteNonQuery()
                End Using
                UpdateBalance(c, tx, table, partyId, -amount)
                Cash(c, tx, If(isReceipt, "وارد", "منصرف"), If(isReceipt, "سند قبض", "سند صرف"),
                     $"سند-{number}", partyName, amount, notes)
                tx.Commit()
                Return number
            End Using
        End Function

        Public Function CreateInstallmentPlan(invoiceNumber As Integer, customerId As Integer, customerName As String,
                                              total As Double, downPayment As Double, interestRate As Double,
                                              months As Integer, firstDue As DateTime,
                                              guarantorName As String, guarantorPhone As String) As Integer
            months = Math.Max(1, Math.Min(60, months))
            Dim principal = Math.Max(0, Math.Round(total - downPayment, 2))
            Dim interest = Math.Round(principal * interestRate / 100.0, 2)
            Dim monthly = Math.Round((principal + interest) / months, 2)
            Using c = Open(), tx = c.BeginTransaction(), cmd = c.CreateCommand()
                cmd.Transaction = tx
                cmd.CommandText = "INSERT INTO InstallmentPlans(InvoiceNumber,CustomerId,CustomerName,Principal,DownPayment,
                    InterestRate,InterestValue,Months,MonthlyAmount,FirstDueDate,GuarantorName,GuarantorPhone)
                    VALUES($inv,$cid,$cn,$pr,$down,$rate,$interest,$months,$monthly,$first,$gn,$gp);SELECT last_insert_rowid()"
                cmd.Parameters.AddWithValue("$inv", invoiceNumber)
                cmd.Parameters.AddWithValue("$cid", customerId)
                cmd.Parameters.AddWithValue("$cn", customerName)
                cmd.Parameters.AddWithValue("$pr", principal)
                cmd.Parameters.AddWithValue("$down", downPayment)
                cmd.Parameters.AddWithValue("$rate", interestRate)
                cmd.Parameters.AddWithValue("$interest", interest)
                cmd.Parameters.AddWithValue("$months", months)
                cmd.Parameters.AddWithValue("$monthly", monthly)
                cmd.Parameters.AddWithValue("$first", firstDue.ToString("yyyy-MM-dd"))
                cmd.Parameters.AddWithValue("$gn", guarantorName)
                cmd.Parameters.AddWithValue("$gp", guarantorPhone)
                Dim planId = Convert.ToInt32(cmd.ExecuteScalar())
                For i = 1 To months
                    cmd.Parameters.Clear()
                    cmd.CommandText = "INSERT INTO Installments(PlanId,CustomerId,CustomerName,Sequence,DueDate,Amount)
                                       VALUES($plan,$cid,$cn,$seq,$due,$amount)"
                    cmd.Parameters.AddWithValue("$plan", planId)
                    cmd.Parameters.AddWithValue("$cid", customerId)
                    cmd.Parameters.AddWithValue("$cn", customerName)
                    cmd.Parameters.AddWithValue("$seq", i)
                    cmd.Parameters.AddWithValue("$due", firstDue.AddMonths(i - 1).ToString("yyyy-MM-dd"))
                    cmd.Parameters.AddWithValue("$amount", If(i = months, Math.Round(principal + interest - monthly * (months - 1), 2), monthly))
                    cmd.ExecuteNonQuery()
                Next
                UpdateBalance(c, tx, "Customers", customerId, interest)
                tx.Commit()
                Return planId
            End Using
        End Function

        Public Sub CollectInstallment(id As Integer)
            Using c = Open(), tx = c.BeginTransaction(), cmd = c.CreateCommand()
                cmd.Transaction = tx
                cmd.CommandText = "SELECT CustomerId,CustomerName,Amount,Sequence,PlanId,Status FROM Installments WHERE Id=$id"
                cmd.Parameters.AddWithValue("$id", id)
                Dim customerId As Integer, sequence As Integer, planId As Integer
                Dim customerName = "", amount As Double, status = ""
                Using r = cmd.ExecuteReader()
                    If Not r.Read() Then Throw New InvalidOperationException("القسط غير موجود")
                    customerId = r.GetInt32(0) : customerName = r.GetString(1)
                    amount = r.GetDouble(2) : sequence = r.GetInt32(2 + 1)
                    planId = r.GetInt32(4) : status = r.GetString(5)
                End Using
                If status = "مدفوع" Then Throw New InvalidOperationException("هذا القسط محصل بالفعل")
                cmd.Parameters.Clear()
                cmd.CommandText = "UPDATE Installments SET Status='مدفوع',PaidAt=datetime('now','localtime') WHERE Id=$id"
                cmd.Parameters.AddWithValue("$id", id)
                cmd.ExecuteNonQuery()
                UpdateBalance(c, tx, "Customers", customerId, -amount)
                Cash(c, tx, "وارد", "تحصيل أقساط", $"قسط-{planId}-{sequence}", customerName, amount, $"تحصيل القسط {sequence}")
                tx.Commit()
            End Using
        End Sub

        Public Function AddExpense(category As String, amount As Double, notes As String) As Integer
            If amount <= 0 Then Throw New InvalidOperationException("قيمة المصروف غير صحيحة")
            Using c = Open(), tx = c.BeginTransaction()
                Dim number = NextNumber(c, tx, "next_expense", 1001)
                Using cmd = c.CreateCommand()
                    cmd.Transaction = tx
                    cmd.CommandText = "INSERT INTO Expenses(Number,Category,Amount,Notes,CreatedAt)
                                       VALUES($n,$c,$a,$notes,datetime('now','localtime'))"
                    cmd.Parameters.AddWithValue("$n", number)
                    cmd.Parameters.AddWithValue("$c", category)
                    cmd.Parameters.AddWithValue("$a", amount)
                    cmd.Parameters.AddWithValue("$notes", notes)
                    cmd.ExecuteNonQuery()
                End Using
                Cash(c, tx, "منصرف", "مصروفات", $"مصروف-{number}", category, amount, notes)
                tx.Commit()
                Return number
            End Using
        End Function

        Public Function CloseShift(notes As String) As Double
            Using c = Open(), tx = c.BeginTransaction(), cmd = c.CreateCommand()
                cmd.Transaction = tx
                cmd.CommandText = "SELECT Id,Number,OpeningCash,OpenedAt FROM Shifts WHERE Status='مفتوحة' ORDER BY Number DESC LIMIT 1"
                Dim id As Integer, number As Integer
                Dim opening As Double, openedAt = ""
                Using r = cmd.ExecuteReader()
                    If Not r.Read() Then Throw New InvalidOperationException("لا توجد وردية مفتوحة")
                    id = r.GetInt32(0) : number = r.GetInt32(1) : opening = r.GetDouble(2) : openedAt = r.GetString(3)
                End Using
                cmd.Parameters.Clear()
                cmd.CommandText = "SELECT IFNULL(SUM(CASE WHEN Direction='وارد' THEN Amount ELSE -Amount END),0)
                                   FROM TreasuryMovements WHERE CreatedAt>=$from AND Source<>'رصيد افتتاحي'"
                cmd.Parameters.AddWithValue("$from", openedAt)
                Dim closing = Math.Round(opening + Convert.ToDouble(cmd.ExecuteScalar()), 2)
                cmd.CommandText = "UPDATE Shifts SET ClosedAt=datetime('now','localtime'),ClosingCash=$close,Status='مغلقة',Notes=$notes WHERE Id=$id"
                cmd.Parameters.AddWithValue("$close", closing)
                cmd.Parameters.AddWithValue("$notes", notes)
                cmd.Parameters.AddWithValue("$id", id)
                cmd.ExecuteNonQuery()
                cmd.Parameters.Clear()
                cmd.CommandText = "INSERT INTO Shifts(Number,OpenedAt,OpeningCash,Status) VALUES($n,datetime('now','localtime'),$open,'مفتوحة')"
                cmd.Parameters.AddWithValue("$n", number + 1)
                cmd.Parameters.AddWithValue("$open", closing)
                cmd.ExecuteNonQuery()
                tx.Commit()
                Return closing
            End Using
        End Function

        Public Function TreasuryBalance() As Double
            Dim t = Query("SELECT IFNULL(SUM(CASE WHEN Direction='وارد' THEN Amount ELSE -Amount END),0) AS Balance FROM TreasuryMovements")
            Return Convert.ToDouble(t.Rows(0)("Balance"))
        End Function

    End Module
End Namespace