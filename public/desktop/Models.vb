' ==========================================================
'  CASH YOU | كاش يو  -  Models.vb
'  كيانات البيانات (كل الأسماء والمسميات بالعربية)
'  الدعم الفني : م / وائل الجمال - 01222355769
' ==========================================================

Imports System.Collections.ObjectModel
Imports System.ComponentModel
Imports System.Runtime.CompilerServices

Namespace Models

    ''' <summary>تصنيف الأصناف</summary>
    Public Class Category
        Public Property Id As Integer
        Public Property Name As String = String.Empty
        Public Property SortOrder As Integer
        Public Overrides Function ToString() As String = Name
    End Class

    ''' <summary>الصنف داخل المخزن</summary>
    Public Class Product
        Public Property Id As Integer
        Public Property Code As String = String.Empty
        Public Property Name As String = String.Empty
        Public Property CategoryId As Integer
        Public Property Unit As String = "قطعة"
        Public Property Price As Double
        Public Property Cost As Double
        Public Property Stock As Double
        Public Property SortOrder As Integer
        Public Overrides Function ToString() As String = Name
    End Class

    ''' <summary>العميل</summary>
    Public Class Customer
        Public Property Id As Integer
        Public Property Name As String = "عميل نقدي"
        Public Property Phone As String = String.Empty
        Public Property Balance As Double
        Public Overrides Function ToString() As String = Name
    End Class

    ''' <summary>طريقة الدفع</summary>
    Public Class PaymentMethod
        Public Property Id As Integer
        Public Property Name As String = "نقدي"
        Public Overrides Function ToString() As String = Name
    End Class

    ''' <summary>سطر داخل فاتورة البيع</summary>
    Public Class InvoiceLine
        Implements INotifyPropertyChanged

        Private _qty As Double = 1
        Private _price As Double
        Private _discount As Double

        Public Property ProductId As Integer
        Public Property Code As String = String.Empty
        Public Property Name As String = String.Empty
        Public Property Unit As String = "قطعة"

        Public Property Qty As Double
            Get
                Return _qty
            End Get
            Set(value As Double)
                If value < 0 Then value = 0
                _qty = value
                Raise()
                Raise(NameOf(Total))
            End Set
        End Property

        Public Property Price As Double
            Get
                Return _price
            End Get
            Set(value As Double)
                If value < 0 Then value = 0
                _price = value
                Raise()
                Raise(NameOf(Total))
            End Set
        End Property

        Public Property Discount As Double
            Get
                Return _discount
            End Get
            Set(value As Double)
                If value < 0 Then value = 0
                _discount = value
                Raise()
                Raise(NameOf(Total))
            End Set
        End Property

        ''' <summary>إجمالي السطر بعد خصم السطر</summary>
        Public ReadOnly Property Total As Double
            Get
                Return Math.Round(Math.Max(0, (Price * Qty) - Discount), 2)
            End Get
        End Property

        Public Event PropertyChanged As PropertyChangedEventHandler _
            Implements INotifyPropertyChanged.PropertyChanged

        Private Sub Raise(<CallerMemberName> Optional prop As String = Nothing)
            RaiseEvent PropertyChanged(Me, New PropertyChangedEventArgs(prop))
        End Sub
    End Class

    ''' <summary>رأس الفاتورة</summary>
    Public Class Invoice
        Public Property Id As Integer
        Public Property Number As Integer
        Public Property CustomerId As Integer?
        Public Property CustomerName As String = "عميل نقدي"
        Public Property PaymentMethod As String = "نقدي"
        Public Property SaleType As String = "نقدي"
        Public Property SubTotal As Double
        Public Property DiscountPercent As Double
        Public Property DiscountValue As Double
        Public Property Total As Double
        Public Property Paid As Double
        Public Property Remaining As Double
        Public Property ItemsCount As Integer
        Public Property UserName As String = "م. وائل الجمال"
        Public Property Printed As Boolean
        Public Property CreatedAt As DateTime = DateTime.Now
    End Class

    ''' <summary>مجموعة أسطر الفاتورة مع تحديث تلقائي للإجماليات</summary>
    Public Class InvoiceLineCollection
        Inherits ObservableCollection(Of InvoiceLine)

        Public Sub New()
            AddHandler Me.CollectionChanged, Sub() RaiseEvent LinesChanged()
        End Sub

        Public Event LinesChanged()

        Public ReadOnly Property SubTotal As Double
            Get
                Return Math.Round(Me.Sum(Function(l) l.Total), 2)
            End Get
        End Property
    End Class

End Namespace