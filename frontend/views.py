from django.shortcuts import render

def index(request):
    return render(request, 'index.html')

def menu(request):
    return render(request, 'menu.html')

def cart(request):
    return render(request, 'cart.html')

def login_view(request):
    return render(request, 'login.html')

def register_view(request):
    return render(request, 'register.html')

def history_view(request):
    return render(request, 'history.html')

def settings_view(request):
    return render(request, 'settings.html')

def book_table_page(request):
    return render(request, 'book_table.html')

def my_reservations_page(request):
    return render(request, 'my_reservations.html')