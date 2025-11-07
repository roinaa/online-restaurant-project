from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import send_mail
from rest_framework import generics, filters, status
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import pagination
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import DishCategory, Dish, Order, OrderItem, UserProfile, Coupon, Table, OperatingHours, Reservation
from .serializers import (
    DishCategorySerializer,
    DishSerializer,
    UserSerializer,
    LoginSerializer,
    OrderSerializer,
    UserProfileSerializer,
    ReviewSerializer,
    ReservationSerializer,
    CreateReservationSerializer
)

import datetime
from django.utils import timezone


class DishCategoryListAPIView(generics.ListAPIView):
    queryset = DishCategory.objects.all()
    serializer_class = DishCategorySerializer

class DishPagination(pagination.PageNumberPagination):
    page_size = 9
    page_size_query_param = 'page_size'
    max_page_size = 100

class DishListAPIView(generics.ListAPIView):
    queryset = Dish.objects.all()
    serializer_class = DishSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['name', 'price']

    pagination_class = DishPagination

    def get_queryset(self):
        queryset = super().get_queryset()

        category_slug = self.request.query_params.get('category')
        if category_slug:
            queryset = queryset.filter(category__slug=category_slug)

        spiciness = self.request.query_params.get('spiciness')
        if spiciness is not None and spiciness.isdigit():
            queryset = queryset.filter(spiciness=spiciness)

        has_nuts = self.request.query_params.get('has_nuts')
        if has_nuts is not None:
            has_nuts_bool = has_nuts.lower() in ('true', '1')
            queryset = queryset.filter(has_nuts=has_nuts_bool)

        is_vegetarian = self.request.query_params.get('is_vegetarian')
        if is_vegetarian is not None:
            is_vegetarian_bool = is_vegetarian.lower() in ('true', '1')
            queryset = queryset.filter(is_vegetarian=is_vegetarian_bool)

        return queryset


# რეგისტრაციის View
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        try:
            subject = 'Welcome to Step Ordering!'
            message = f'Hi {user.username},\n\nThank you for registering at Step Ordering. We are excited to see you!'

            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )
        except Exception as e:
            print(f"Error sending welcome email: {e}")

# ლოგინის View
class LoginView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        # ვიღებთ ან ვქმნით Token-ს ამ მომხმარებლისთვის
        token, created = Token.objects.get_or_create(user=user)

        # ვაბრუნებთ Token-ს და მომხმარებლის სახელს Frontend-ზე
        return Response({
            'token': token.key,
            'user_id': user.id,
            'username': user.username
        }, status=status.HTTP_200_OK)


# ლოგაუთის View
class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        try:
            request.user.auth_token.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# კალათის მართვის View
class CartView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        cart, created = Order.objects.get_or_create(user=request.user, status='pending')
        cart.calculate_total()
        serializer = OrderSerializer(cart)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        dish_id = request.data.get('dish_id')
        quantity = int(request.data.get('quantity', 1))

        if not dish_id:
            return Response({"error": "Dish ID is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            dish = Dish.objects.get(id=dish_id)
        except Dish.DoesNotExist:
            return Response({"error": "Dish not found"}, status=status.HTTP_404_NOT_FOUND)

        cart, created = Order.objects.get_or_create(user=request.user, status='pending')

        order_item, item_created = OrderItem.objects.get_or_create(
            order=cart,
            dish=dish
        )

        if item_created:
            order_item.quantity = quantity
        else:
            order_item.quantity += quantity

        order_item.save()

        cart.calculate_total()
        serializer = OrderSerializer(cart)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def put(self, request, *args, **kwargs):
        item_id = request.data.get('item_id')
        new_quantity = int(request.data.get('quantity', 0))

        if not item_id or new_quantity <= 0:
            return Response({"error": "Valid Item ID and quantity are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order_item = OrderItem.objects.get(id=item_id, order__user=request.user, order__status='pending')
            order_item.quantity = new_quantity
            order_item.save()

            order_item.order.calculate_total()
            serializer = OrderSerializer(order_item.order)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except OrderItem.DoesNotExist:
            return Response({"error": "Item not found in your cart"}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request):
        item_id = request.data.get('item_id')

        try:
            # ვპოულობთ მომხმარებლის კალათას
            cart = Order.objects.get(user=request.user, status='pending')
        except Order.DoesNotExist:
            return Response({"error": "Cart not found."}, status=status.HTTP_404_NOT_FOUND)

        if item_id:
            # ვშლით ერთ კონკრეტულ ნივთს
            try:
                order_item = OrderItem.objects.get(id=item_id, order=cart)
                order_item.delete()
            except OrderItem.DoesNotExist:
                return Response({"error": "Item not found in your cart"}, status=status.HTTP_404_NOT_FOUND)
        else:
            # ვასუფთავებთ მთლიან კალათას
            cart.items.all().delete()

        cart.calculate_total()
        serializer = OrderSerializer(cart)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PlaceOrderView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        try:
            # ვპოულობთ მომხმარებლის აქტიურ კალათას
            cart = Order.objects.get(user=request.user, status='pending')
        except Order.DoesNotExist:
            return Response({"error": "You do not have an active cart."}, status=status.HTTP_404_NOT_FOUND)

        # ვამოწმებთ, ხომ არ არის კალათა ცარიელი
        if not cart.items.all().exists():
            return Response({"error": "Your cart is empty."}, status=status.HTTP_400_BAD_REQUEST)

        cart.calculate_total()

        # ვაქცევთ შეკვეთად
        cart.status = 'completed'
        cart.save()

        try:
            # ვქმნით შეკვეთის დეტალურ ტექსტს
            order_details = ""
            for item in cart.items.all():
                order_details += f"- {item.dish.name} (x{item.quantity}) - ${item.get_total_price()}\n"

            if cart.coupon:
                order_details += f"\nCoupon Applied: {cart.coupon.code} (-{cart.coupon.discount_percent}%)\n"

            subject = f'Your Step Ordering Order #{cart.id} is Confirmed!'
            message = f'Hi {request.user.username},\n\nYour order has been successfully placed.\n\n' \
                      f'Order Summary:\n{order_details}\n' \
                      f'Total Price: ${cart.total_price}\n\nThank you for your purchase!'

            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [request.user.email],
                fail_silently=False,
            )
        except Exception as e:
            print(f"Error sending order confirmation email: {e}")

        # ვაბრუნებთ დასრულებულ შეკვეთას
        serializer = OrderSerializer(cart)
        return Response(serializer.data, status=status.HTTP_200_OK)


class OrderHistoryView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # ვპოულობთ ამ მომხმარებლის ყველა დასრულებულ შეკვეთას
        completed_orders = Order.objects.filter(
            user=request.user,
            status='completed'
        ).order_by('-created_at') # დავალაგოთ უახლესის მიხედვით

        serializer = OrderSerializer(completed_orders, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)




class UserProfileView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        profile, created = UserProfile.objects.get_or_create(user=request.user)
        serializer = UserProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, *args, **kwargs):
        profile, created = UserProfile.objects.get_or_create(user=request.user)
        serializer = UserProfileSerializer(profile, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class FeaturedDishListView(generics.ListAPIView):
    queryset = Dish.objects.filter(is_featured=True)
    serializer_class = DishSerializer
    permission_classes = (AllowAny,)


class ChangePasswordView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        new_password_confirm = request.data.get('new_password_confirm')

        # ვამოწმებთ, ძველი პაროლი სწორია თუ არა
        if not user.check_password(old_password):
            return Response({"old_password": ["Incorrect old password."]}, status=status.HTTP_400_BAD_REQUEST)

        # ვამოწმებთ, ახალი პაროლები ემთხვევა თუ არა
        if new_password != new_password_confirm:
            return Response({"new_password": ["New passwords do not match."]}, status=status.HTTP_400_BAD_REQUEST)

        if user.check_password(new_password):
            return Response(
                {"new_password": ["Your new password cannot be the same as your old password."]},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(new_password) < 8:
             return Response({"new_password": ["Password must be at least 8 characters long."]}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        return Response({"message": "Password updated successfully"}, status=status.HTTP_200_OK)




class ReviewCreateView(APIView):

    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user
        data = request.data.copy()

        try:
            # ვამოწმებთ, აქვს თუ არა მომხმარებელს ეს კერძი ნაყიდი
            dish_id = data.get('dish')
            dish = Dish.objects.get(id=dish_id)

            is_purchased = OrderItem.objects.filter(
                order__user=user,
                order__status='completed',
                dish=dish
            ).exists()

            if not is_purchased:
                return Response({"error": "You can only review dishes you have purchased."}, status=status.HTTP_403_FORBIDDEN)

            # ვქმნით შეფასებას სერიალიზატორის დახმარებით
            serializer = ReviewSerializer(data=data, context={'request': request})

            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        except Dish.DoesNotExist:
            return Response({"error": "Dish not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ApplyCouponView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        coupon_code = request.data.get('coupon_code')
        user = request.user

        try:
            cart = Order.objects.get(user=user, status='pending')
        except Order.DoesNotExist:
            return Response({"error": "You have no active cart."}, status=status.HTTP_404_NOT_FOUND)

        try:
            coupon = Coupon.objects.get(code__iexact=coupon_code, is_active=True)
        except Coupon.DoesNotExist:
            return Response({"error": "Invalid coupon code."}, status=status.HTTP_404_NOT_FOUND)

        if coupon.one_use_per_user:
            has_used_before = Order.objects.filter(
                user=user,
                coupon=coupon,
                status='completed'
            ).exists()
            if has_used_before:
                return Response({"error": "You have already used this coupon code."}, status=status.HTTP_400_BAD_REQUEST)

        if cart.coupon == coupon:
            return Response(
           {"error": "This coupon is already applied."},
                 status=status.HTTP_409_CONFLICT
            )

        cart.coupon = coupon
        cart.calculate_total()
        cart.save()

        serializer = OrderSerializer(cart)
        return Response(serializer.data, status=status.HTTP_200_OK)


class RemoveCouponView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user

        try:
            cart = Order.objects.get(user=user, status='pending')
        except Order.DoesNotExist:
            return Response({"error": "You have no active cart."}, status=status.HTTP_404_NOT_FOUND)

        if not cart.coupon:
            return Response({"error": "No coupon is applied to this cart."}, status=status.HTTP_400_BAD_REQUEST)

        cart.coupon = None
        cart.calculate_total()
        cart.save()

        serializer = OrderSerializer(cart)
        return Response(serializer.data, status=status.HTTP_200_OK)


class GetAvailabilityView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_str = request.query_params.get('date')
        table_id = request.query_params.get('table_id')

        if not date_str or not table_id:
            return Response({"error": "Date and Table ID are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            date = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
            table = Table.objects.get(id=table_id)
        except (ValueError, Table.DoesNotExist):
            return Response({"error": "Invalid date or table ID."}, status=status.HTTP_400_BAD_REQUEST)

        # ვპოულობ ამ დღის სამუშაო საათებს
        try:
            hours = OperatingHours.objects.get(weekday=date.weekday())
            open_time = hours.open_time
            close_time = hours.close_time
        except OperatingHours.DoesNotExist:
            return Response({"error": "Restaurant is closed on this day."}, status=status.HTTP_400_BAD_REQUEST)

        # ვპოულობ ამ მაგიდის ყველა დადასტურებულ ჯავშანს ამ დღეს
        reservations = Reservation.objects.filter(
            table=table,
            status='Confirmed',
            start_time__date=date
        ).values_list('start_time', 'end_time')

        # 30 წუთიანი სლოტების გენერირება
        slots = []
        current_time = timezone.make_aware(datetime.datetime.combine(date, open_time))
        end_datetime = timezone.make_aware(datetime.datetime.combine(date, close_time))

        while current_time < end_datetime:
            slot_time = current_time.time()
            is_available = True

            # მოწმდება ხომ არ ემთხვევა სლოტი არსებულ ჯავშანს
            for start, end in reservations:
                # მომწდება თუ სლოტი არსებული ჯავშნის შიგნით ექცევა
                if current_time >= start and current_time < end:
                    is_available = False
                    break

            if date == timezone.now().date() and current_time < timezone.now():
                is_available = False

            slots.append({"time": slot_time.strftime('%H:%M'), "available": is_available})
            current_time += datetime.timedelta(minutes=30)

        return Response(slots, status=status.HTTP_200_OK)


class CreateReservationView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreateReservationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        party_size = data['party_size']
        date = data['date']
        start_time_obj = data['start_time']  #
        end_time_obj = data['end_time_str']

        # მაგიდის მოძებნა
        try:
            table = Table.objects.filter(capacity__gte=party_size, is_active=True).order_by('capacity').first()
            if not table:
                return Response({"error": f"Sorry, we do not have a table available for {party_size} guests."},
                                status=status.HTTP_400_BAD_REQUEST)
        except Table.DoesNotExist:
            return Response({"error": "No tables found."}, status=status.HTTP_400_BAD_REQUEST)

        # სამუშაო საათები
        try:
            hours = OperatingHours.objects.get(weekday=date.weekday())

            start_datetime = timezone.make_aware(datetime.datetime.combine(date, start_time_obj))
            end_datetime = timezone.make_aware(datetime.datetime.combine(date, end_time_obj))

            # 10 საათიანი ლიმიტის შემოწმება
            duration = end_datetime - start_datetime
            if duration.total_seconds() / 3600 > 10:
                return Response({
                                    "error": "To book a table for more than 10 hours, please contact the restaurant directly at +123 456 789."},
                                status=status.HTTP_400_BAD_REQUEST)

            if start_datetime.time() < hours.open_time or end_datetime.time() > hours.close_time:
                if end_datetime.date() > date or end_datetime.time() > hours.close_time:
                    return Response({
                                        "error": f"The restaurant closes at {hours.close_time.strftime('%H:%M')}. Your selected reservation time exceeds operating hours."},
                                    status=status.HTTP_400_BAD_REQUEST)

            if start_datetime < timezone.now():
                return Response({"error": "Cannot book a reservation in the past."}, status=status.HTTP_400_BAD_REQUEST)

            if start_datetime >= end_datetime:
                return Response({"error": "End time must be after start time."}, status=status.HTTP_400_BAD_REQUEST)

        except OperatingHours.DoesNotExist:
            return Response({"error": "Restaurant is closed on this day."}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError:
            return Response({"error": "Invalid time format."}, status=status.HTTP_400_BAD_REQUEST)

        # საბოლოო შემოწმება
        conflicting_reservations = Reservation.objects.filter(
            table=table,
            status='Confirmed',
            start_time__lt=end_datetime,
            end_time__gt=start_datetime
        ).exists()

        if conflicting_reservations:
            return Response({
                                "error": "Sorry, one or more time slots in your selected range were just booked by another user. Please refresh and try again."},
                            status=status.HTTP_409_CONFLICT)

        # ვქმნით ჯავშანს
        reservation = Reservation.objects.create(
            user=request.user,
            table=table,
            party_size=party_size,
            start_time=start_datetime,
            end_time=end_datetime,
            status='Confirmed'
        )

        try:
            subject = f'Your Table Reservation is Confirmed! (ID: #{reservation.id})'
            message = f'Hi {request.user.username},\n\nYour reservation is confirmed:\n\n' \
                      f'Table: {reservation.table.name}\n' \
                      f'Guests: {reservation.party_size}\n' \
                      f'Date: {reservation.start_time.strftime("%Y-%m-%d")}\n' \
                      f'Time: {reservation.start_time.strftime("%H:%M")} - {reservation.end_time.strftime("%H:%M")}\n\n' \
                      f'We look forward to seeing you!'

            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [request.user.email],
                fail_silently=False,
            )
        except Exception as e:
            print(f"Error sending reservation confirmation email: {e}")

        return Response(ReservationSerializer(reservation).data, status=status.HTTP_201_CREATED)



class ReservationHistoryView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()

        active_reservations = Reservation.objects.filter(
            user=request.user,
            status='Confirmed',
            end_time__gte=now
        ).order_by('start_time')

        past_reservations = Reservation.objects.filter(
            user=request.user,
            end_time__lt=now
        ) | Reservation.objects.filter(
            user=request.user,
            status='Cancelled'
        ).order_by('-start_time')

        data = {
            "active": ReservationSerializer(active_reservations, many=True).data,
            "past": ReservationSerializer(past_reservations, many=True).data
        }
        return Response(data, status=status.HTTP_200_OK)


class CancelReservationView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            reservation = Reservation.objects.get(id=pk, user=request.user)
        except Reservation.DoesNotExist:
            return Response({"error": "Reservation not found."}, status=status.HTTP_404_NOT_FOUND)

        if reservation.start_time <= timezone.now():
            return Response({"error": "Cannot cancel a reservation that has already started or passed."},
                            status=status.HTTP_400_BAD_REQUEST)

        if reservation.status == 'Cancelled':
            return Response({"error": "This reservation is already cancelled."}, status=status.HTTP_400_BAD_REQUEST)

        reservation.status = 'Cancelled'
        reservation.save()

        return Response(ReservationSerializer(reservation).data, status=status.HTTP_200_OK)
