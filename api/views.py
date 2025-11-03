from rest_framework import generics
from .models import DishCategory, Dish
from .serializers import DishCategorySerializer, DishSerializer, UserSerializer, LoginSerializer
from rest_framework import filters
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from .models import Order, OrderItem, UserProfile, Review
from .serializers import OrderSerializer, UserProfileSerializer, ReviewSerializer
from rest_framework.authentication import TokenAuthentication


class DishCategoryListAPIView(generics.ListAPIView):
    queryset = DishCategory.objects.all()
    serializer_class = DishCategorySerializer

class DishListAPIView(generics.ListAPIView):
    queryset = Dish.objects.all()
    serializer_class = DishSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['name', 'price']

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

    def delete(self, request, *args, **kwargs):
        item_id = request.data.get('item_id')

        if not item_id:
            return Response({"error": "Item ID is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order_item = OrderItem.objects.get(id=item_id, order__user=request.user, order__status='pending')
            cart = order_item.order
            order_item.delete()

            cart.calculate_total()  # ვაახლებთ ჯამურ ფასს
            serializer = OrderSerializer(cart)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except OrderItem.DoesNotExist:
            return Response({"error": "Item not found in your cart"}, status=status.HTTP_404_NOT_FOUND)


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