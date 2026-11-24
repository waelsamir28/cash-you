' ==========================================================
'  CASH YOU | كاش يو  -  Database.vb
'  طبقة الوصول إلى قاعدة بيانات SQLite
'  الدعم الفني : م / وائل الجمال - 01222355769
' ==========================================================

Imports System.IO
Imports CashYou.Models
Imports Microsoft.Data.Sqlite

Namespace Data

    Public NotInheritable Class Database

        Private Shared ReadOnly DbPath As String =
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "cashyou.db")

        Private Shared ReadOnly ConnString As String =
            $"Data Source={DbPath};Cache=Shared;Foreign Keys=True"

        Private Sub New()
        End Sub

        Private Shared Function Open() As SqliteConnection
            Dim c As New SqliteConnection(ConnString)
            c.Open()
            Return c
        End Function

        ' =====================================================
        '  إنشاء الجداول وبذر البيانات لأول تشغيل
        ' =====================================================
        Public Shared Sub Initialize()
            Using c = Open()
                Execute(c, "
CREATE TABLE IF NOT EXISTS Categories(
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    SortOrder INTEGER NOT NULL DEFAULT 0);

CREATE TABLE IF NOT EXISTS Products(
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Code TEXT NOT NULL UNIQUE,
    Name TEXT NOT NULL,
    CategoryId INTEGER NOT NULL DEFAULT 0,
    Unit TEXT NOT NULL DEFAULT 'قطعة',
    Price REAL NOT NULL DEFAULT 0,
    Cost REAL NOT NULL DEFAULT 0,
    Stock REAL NOT NULL DEFAULT 0,
    SortOrder INTEGER NOT NULL DEFAULT 0);

CREATE TABLE IF NOT EXISTS Customers(
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    Phone TEXT NOT NULL DEFAULT '',
    Balance REAL NOT NULL DEFAULT 0);

CREATE TABLE IF NOT EXISTS PaymentMethods(
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS Invoices(
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Number INTEGER NOT NULL,
    CustomerId INTEGER NULL,
    CustomerName TEXT NOT NULL DEFAULT 'عميل نقدي',
    PaymentMethod TEXT NOT NULL DEFAULT 'نقدي',
    SaleType TEXT NOT NULL DEFAULT 'نقدي',
    SubTotal REAL NOT NULL DEFAULT 0,
    DiscountPercent REAL NOT NULL DEFAULT 0,
    DiscountValue REAL NOT NULL DEFAULT 0,
    Total REAL NOT NULL DEFAULT 0,
    Paid REAL NOT NULL DEFAULT 0,
    Remaining REAL NOT NULL DEFAULT 0,
    ItemsCount INTEGER NOT NULL DEFAULT 0,
    UserName TEXT NOT NULL DEFAULT 'م. وائل الجمال',
    Printed INTEGER NOT NULL DEFAULT 0,
    CreatedAt TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS InvoiceItems(
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    InvoiceId INTEGER NOT NULL,
    ProductId INTEGER NULL,
    Code TEXT NOT NULL,
    Name TEXT NOT NULL,
    Unit TEXT NOT NULL,
    Qty REAL NOT NULL,
    Price REAL NOT NULL,
    Discount REAL NOT NULL DEFAULT 0,
    Total REAL NOT NULL,
    FOREIGN KEY(InvoiceId) REFERENCES Invoices(Id) ON DELETE CASCADE);

CREATE TABLE IF NOT EXISTS Settings(
    Key TEXT PRIMARY KEY,
    Value TEXT NOT NULL);
")
                Seed(c)
            End Using
        End Sub

        Private Shared Sub Execute(c As SqliteConnection, sql As String)
            Using cmd = c.CreateCommand()
                cmd.CommandText = sql
                cmd.ExecuteNonQuery()
            End Using
        End Sub

        Private Shared Function Scalar(c As SqliteConnection, sql As String) As Object
            Using cmd = c.CreateCommand()
                cmd.CommandText = sql
                Return cmd.ExecuteScalar()
            End Using
        End Function

        ' =====================================================
        '  بذر البيانات العربية
        ' =====================================================
        Private Shared Sub Seed(c As SqliteConnection)
            Dim count = Convert.ToInt32(Scalar(c, "SELECT COUNT(*) FROM Categories"))
            If count > 0 Then Return

            Dim cats = {"أقلام جاف ورصاص", "كراسات وكشاكيل", "أدوات مكتبية",
                        "ألوان وأدوات رسم", "حقائب ومقالم", "ورق ودفاتر", "مستلزمات كمبيوتر"}
            For i = 0 To cats.Length - 1
                Execute(c, $"INSERT INTO Categories(Name,SortOrder) VALUES('{cats(i)}',{i});")
            Next

            Dim prods = New (String, String, Integer, String, Double, Double)() {
                ("1001", "قلم جاف أزرق بايك", 1, "قطعة", 5.0, 240),
                ("1002", "قلم جاف أحمر بايك", 1, "قطعة", 5.0, 180),
                ("1003", "قلم جاف أسود بايك", 1, "قطعة", 5.0, 300),
                ("1004", "قلم رصاص فابر كاستل HB", 1, "قطعة", 7.5, 420),
                ("1006", "قلم سائل أزرق 0.5", 1, "قطعة", 12.0, 96),
                ("1010", "طقم أقلام جاف 10 قطع", 1, "طقم", 42.0, 40),
                ("2001", "كراسة 60 ورقة سلك", 2, "قطعة", 22.0, 300),
                ("2002", "كراسة 100 ورقة سلك", 2, "قطعة", 32.0, 260),
                ("2003", "كشكول 200 ورقة مجلد", 2, "قطعة", 68.0, 90),
                ("2005", "كراسة 40 ورقة عادي", 2, "قطعة", 14.0, 400),
                ("3001", "دباسة مكتبية كبيرة", 3, "قطعة", 85.0, 26),
                ("3003", "مقص مكتبي 8 بوصة", 3, "قطعة", 34.0, 62),
                ("3005", "صمغ عصا 21 جم", 3, "قطعة", 16.0, 130),
                ("3006", "استيكة بيضاء", 3, "قطعة", 5.0, 380),
                ("4001", "علبة ألوان خشبية 12 لون", 4, "علبة", 48.0, 70),
                ("4003", "ألوان فلوماستر 12 لون", 4, "علبة", 56.0, 58),
                ("5001", "شنطة ظهر مدرسية", 5, "قطعة", 385.0, 24),
                ("5002", "مقلمة قماش زيبر", 5, "قطعة", 45.0, 80),
                ("6001", "رزمة ورق A4 500 ورقة", 6, "رزمة", 165.0, 85),
                ("6008", "رول كاشير 80 مم", 6, "رول", 14.0, 320),
                ("7001", "فلاشة 32 جيجا", 7, "قطعة", 195.0, 42),
                ("7002", "ماوس لاسلكي", 7, "قطعة", 175.0, 33)
            }
            For Each p In prods
                Execute(c, "INSERT INTO Products(Code,Name,CategoryId,Unit,Price,Cost,Stock) VALUES(" &
                           $"'{p.Item1}','{p.Item2}',{p.Item3},'{p.Item4}',{p.Item5},{Math.Round(p.Item5 * 0.72, 2)},{p.Item6});")
            Next

            Dim custs = New (String, String, Double)() {
                ("عميل نقدي", "", 0),
                ("مكتبة النور - طنطا", "01001234567", 1250),
                ("مدرسة الأمل الخاصة", "01118887766", 0),
                ("شركة الدلتا للتوريدات", "01234567890", 3480.5)
            }
            For Each cu In custs
                Execute(c, $"INSERT INTO Customers(Name,Phone,Balance) VALUES('{cu.Item1}','{cu.Item2}',{cu.Item3});")
            Next

            For Each m In {"نقدي", "فيزا", "محفظة إلكترونية", "تحويل بنكي", "شيك"}
                Execute(c, $"INSERT INTO PaymentMethods(Name) VALUES('{m}');")
            Next

            Execute(c, "INSERT INTO Settings(Key,Value) VALUES('next_invoice','4016');")
            Execute(c, "INSERT INTO Settings(Key,Value) VALUES('shop_name','كاش يو للتجارة والتوريدات المكتبية');")
            Execute(c, "INSERT INTO Settings(Key,Value) VALUES('shop_phone','01222355769');")
        End Sub

        ' =====================================================
        '  الاستعلامات
        ' =====================================================
        Public Shared Function GetCategories() As List(Of Category)
            Dim list As New List(Of Category)
            Using c = Open(), cmd = c.CreateCommand()
                cmd.CommandText = "SELECT Id,Name,SortOrder FROM Categories ORDER BY SortOrder;"
                Using r = cmd.ExecuteReader()
                    While r.Read()
                        list.Add(New Category With {
                            .Id = r.GetInt32(0), .Name = r.GetString(1), .SortOrder = r.GetInt32(2)})
                    End While
                End Using
            End Using
            Return list
        End Function

        Public Shared Function GetProducts() As List(Of Product)
            Dim list As New List(Of Product)
            Using c = Open(), cmd = c.CreateCommand()
                cmd.CommandText = "SELECT Id,Code,Name,CategoryId,Unit,Price,Cost,Stock,SortOrder
                                   FROM Products ORDER BY SortOrder;"
                Using r = cmd.ExecuteReader()
                    While r.Read()
                        list.Add(New Product With {
                            .Id = r.GetInt32(0), .Code = r.GetString(1), .Name = r.GetString(2),
                            .CategoryId = r.GetInt32(3), .Unit = r.GetString(4),
                            .Price = r.GetDouble(5), .Cost = r.GetDouble(6),
                            .Stock = r.GetDouble(7), .SortOrder = r.GetInt32(8)})
                    End While
                End Using
            End Using
            Return list
        End Function

        Public Shared Function FindProductByCode(code As String) As Product
            Return GetProducts().FirstOrDefault(
                Function(p) p.Code = code OrElse p.Code.EndsWith(code) OrElse p.Name.Contains(code))
        End Function

        Public Shared Function GetCustomers() As List(Of Customer)
            Dim list As New List(Of Customer)
            Using c = Open(), cmd = c.CreateCommand()
                cmd.CommandText = "SELECT Id,Name,Phone,Balance FROM Customers ORDER BY Id;"
                Using r = cmd.ExecuteReader()
                    While r.Read()
                        list.Add(New Customer With {
                            .Id = r.GetInt32(0), .Name = r.GetString(1),
                            .Phone = r.GetString(2), .Balance = r.GetDouble(3)})
                    End While
                End Using
            End Using
            Return list
        End Function

        Public Shared Function GetPaymentMethods() As List(Of PaymentMethod)
            Dim list As New List(Of PaymentMethod)
            Using c = Open(), cmd = c.CreateCommand()
                cmd.CommandText = "SELECT Id,Name FROM PaymentMethods ORDER BY Id;"
                Using r = cmd.ExecuteReader()
                    While r.Read()
                        list.Add(New PaymentMethod With {.Id = r.GetInt32(0), .Name = r.GetString(1)})
                    End While
                End Using
            End Using
            Return list
        End Function

        Public Shared Function AddPaymentMethod(name As String) As PaymentMethod
            Using c = Open(), cmd = c.CreateCommand()
                cmd.CommandText = "INSERT INTO PaymentMethods(Name) VALUES($n);SELECT last_insert_rowid();"
                cmd.Parameters.AddWithValue("$n", name)
                Dim id = Convert.ToInt32(cmd.ExecuteScalar())
                Return New PaymentMethod With {.Id = id, .Name = name}
            End Using
        End Function

        Public Shared Function AddCustomer(name As String, phone As String, balance As Double) As Customer
            Using c = Open(), cmd = c.CreateCommand()
                cmd.CommandText = "INSERT INTO Customers(Name,Phone,Balance) VALUES($n,$p,$b);
                                   SELECT last_insert_rowid();"
                cmd.Parameters.AddWithValue("$n", name)
                cmd.Parameters.AddWithValue("$p", phone)
                cmd.Parameters.AddWithValue("$b", balance)
                Dim id = Convert.ToInt32(cmd.ExecuteScalar())
                Return New Customer With {.Id = id, .Name = name, .Phone = phone, .Balance = balance}
            End Using
        End Function

        Public Shared Function GetSetting(key As String, fallback As String) As String
            Using c = Open(), cmd = c.CreateCommand()
                cmd.CommandText = "SELECT Value FROM Settings WHERE Key=$k;"
                cmd.Parameters.AddWithValue("$k", key)
                Dim o = cmd.ExecuteScalar()
                Return If(o Is Nothing, fallback, o.ToString())
            End Using
        End Function

        Public Shared Sub SetSetting(key As String, value As String)
            Using c = Open(), cmd = c.CreateCommand()
                cmd.CommandText = "INSERT INTO Settings(Key,Value) VALUES($k,$v)
                                   ON CONFLICT(Key) DO UPDATE SET Value=$v;"
                cmd.Parameters.AddWithValue("$k", key)
                cmd.Parameters.AddWithValue("$v", value)
                cmd.ExecuteNonQuery()
            End Using
        End Sub

        Public Shared Function NextInvoiceNumber() As Integer
            Dim v As Integer
            Return If(Integer.TryParse(GetSetting("next_invoice", "4016"), v), v, 4016)
        End Function

        ' =====================================================
        '  حفظ الفاتورة داخل معاملة واحدة
        ' =====================================================
        Public Shared Function SaveInvoice(inv As Invoice, lines As IEnumerable(Of InvoiceLine)) As Integer
            Using c = Open()
                Using tx = c.BeginTransaction()

                    Dim number = NextInvoiceNumber()
                    inv.Number = number

                    Using cmd = c.CreateCommand()
                        cmd.Transaction = tx
                        cmd.CommandText = "
INSERT INTO Invoices(Number,CustomerId,CustomerName,PaymentMethod,SaleType,SubTotal,
                     DiscountPercent,DiscountValue,Total,Paid,Remaining,ItemsCount,UserName,Printed,CreatedAt)
VALUES($num,$cid,$cname,$pm,$st,$sub,$dp,$dv,$tot,$paid,$rem,$cnt,$user,$prn,$at);
SELECT last_insert_rowid();"
                        cmd.Parameters.AddWithValue("$num", number)
                        cmd.Parameters.AddWithValue("$cid", If(inv.CustomerId.HasValue, CObj(inv.CustomerId.Value), DBNull.Value))
                        cmd.Parameters.AddWithValue("$cname", inv.CustomerName)
                        cmd.Parameters.AddWithValue("$pm", inv.PaymentMethod)
                        cmd.Parameters.AddWithValue("$st", inv.SaleType)
                        cmd.Parameters.AddWithValue("$sub", inv.SubTotal)
                        cmd.Parameters.AddWithValue("$dp", inv.DiscountPercent)
                        cmd.Parameters.AddWithValue("$dv", inv.DiscountValue)
                        cmd.Parameters.AddWithValue("$tot", inv.Total)
                        cmd.Parameters.AddWithValue("$paid", inv.Paid)
                        cmd.Parameters.AddWithValue("$rem", inv.Remaining)
                        cmd.Parameters.AddWithValue("$cnt", lines.Count())
                        cmd.Parameters.AddWithValue("$user", inv.UserName)
                        cmd.Parameters.AddWithValue("$prn", If(inv.Printed, 1, 0))
                        cmd.Parameters.AddWithValue("$at", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"))
                        inv.Id = Convert.ToInt32(cmd.ExecuteScalar())
                    End Using

                    For Each l In lines
                        Using cmd = c.CreateCommand()
                            cmd.Transaction = tx
                            cmd.CommandText = "
INSERT INTO InvoiceItems(InvoiceId,ProductId,Code,Name,Unit,Qty,Price,Discount,Total)
VALUES($iid,$pid,$code,$name,$unit,$qty,$price,$disc,$tot);"
                            cmd.Parameters.AddWithValue("$iid", inv.Id)
                            cmd.Parameters.AddWithValue("$pid", l.ProductId)
                            cmd.Parameters.AddWithValue("$code", l.Code)
                            cmd.Parameters.AddWithValue("$name", l.Name)
                            cmd.Parameters.AddWithValue("$unit", l.Unit)
                            cmd.Parameters.AddWithValue("$qty", l.Qty)
                            cmd.Parameters.AddWithValue("$price", l.Price)
                            cmd.Parameters.AddWithValue("$disc", l.Discount)
                            cmd.Parameters.AddWithValue("$tot", l.Total)
                            cmd.ExecuteNonQuery()
                        End Using

                        Using cmd = c.CreateCommand()
                            cmd.Transaction = tx
                            cmd.CommandText = "UPDATE Products SET Stock = Stock - $q WHERE Id=$id;"
                            cmd.Parameters.AddWithValue("$q", l.Qty)
                            cmd.Parameters.AddWithValue("$id", l.ProductId)
                            cmd.ExecuteNonQuery()
                        End Using
                    Next

                    If inv.CustomerId.HasValue AndAlso inv.Remaining <> 0 Then
                        Using cmd = c.CreateCommand()
                            cmd.Transaction = tx
                            cmd.CommandText = "UPDATE Customers SET Balance = Balance + $r WHERE Id=$id;"
                            cmd.Parameters.AddWithValue("$r", inv.Remaining)
                            cmd.Parameters.AddWithValue("$id", inv.CustomerId.Value)
                            cmd.ExecuteNonQuery()
                        End Using
                    End If

                    If inv.Paid > 0 Then
                        Using cmd = c.CreateCommand()
                            cmd.Transaction = tx
                            cmd.CommandText = "INSERT INTO TreasuryMovements(Direction,Source,Reference,PartyName,Amount,Notes,CreatedAt)
                                               VALUES('وارد','مبيعات',$ref,$party,$amount,$notes,datetime('now','localtime'));"
                            cmd.Parameters.AddWithValue("$ref", $"بيع-{number}")
                            cmd.Parameters.AddWithValue("$party", inv.CustomerName)
                            cmd.Parameters.AddWithValue("$amount", inv.Paid)
                            cmd.Parameters.AddWithValue("$notes", If(inv.SaleType = "تقسيط", "مقدم تعاقد تقسيط", "مدفوع فاتورة مبيعات"))
                            cmd.ExecuteNonQuery()
                        End Using
                    End If

                    tx.Commit()
                    SetSetting("next_invoice", (number + 1).ToString())
                    Return number
                End Using
            End Using
        End Function

        Public Shared Function GetRecentInvoices(Optional take As Integer = 40) As List(Of Invoice)
            Dim list As New List(Of Invoice)
            Using c = Open(), cmd = c.CreateCommand()
                cmd.CommandText = $"SELECT Id,Number,CustomerName,PaymentMethod,SaleType,Total,Paid,
                                           Remaining,ItemsCount,CreatedAt
                                    FROM Invoices ORDER BY Number DESC LIMIT {take};"
                Using r = cmd.ExecuteReader()
                    While r.Read()
                        list.Add(New Invoice With {
                            .Id = r.GetInt32(0), .Number = r.GetInt32(1),
                            .CustomerName = r.GetString(2), .PaymentMethod = r.GetString(3),
                            .SaleType = r.GetString(4), .Total = r.GetDouble(5),
                            .Paid = r.GetDouble(6), .Remaining = r.GetDouble(7),
                            .ItemsCount = r.GetInt32(8), .CreatedAt = DateTime.Parse(r.GetString(9))})
                    End While
                End Using
            End Using
            Return list
        End Function

    End Class

End Namespace