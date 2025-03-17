"use client"
import React, { useState } from 'react';
import { Laptop, ShoppingCart, User, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';

// Product data
const products = [
  {
    id: 1,
    name: "Wireless Headphones",
    price: 129.99,
    image: "headphones",
    description: "Premium noise-cancelling wireless headphones with 30-hour battery life."
  },
  {
    id: 2,
    name: "Smart Watch",
    price: 199.99,
    image: "smartwatch",
    description: "Track your fitness, sleep, and notifications with this sleek smartwatch."
  },
  {
    id: 3,
    name: "Portable Speaker",
    price: 89.99,
    image: "speaker",
    description: "Waterproof portable speaker with immersive 360° sound."
  },
  {
    id: 4,
    name: "Wireless Charger",
    price: 49.99,
    image: "charger",
    description: "Fast wireless charging pad compatible with all Qi-enabled devices."
  },
  {
    id: 5,
    name: "Tablet Stand",
    price: 29.99,
    image: "stand",
    description: "Adjustable aluminum stand for tablets and smartphones."
  },
  {
    id: 6,
    name: "USB-C Hub",
    price: 59.99,
    image: "usbhub",
    description: "6-in-1 USB-C hub with HDMI, USB 3.0, and SD card reader."
  }
];

// Main App Component
const EcommerceApp = () => {
  const [currentPage, setCurrentPage] = useState('phone-login');
  const [cart, setCart] = useState([]);
  const [userName, setUserName] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [addedToCart, setAddedToCart] = useState(null);
  const [, setOtpSent] = useState(false);

  // Calculate total cart value
  const cartTotal = cart.reduce((total, item: any) => total + (item.price * item.quantity), 0);

  // Add product to cart
  const addToCart = (product: any) => {
    const existingItem = cart.find((item: any) => item.id === product.id);
    
    if (existingItem) {
      setCart(cart.map((item: any) => 
        item.id === product.id ? {...item, quantity: item.quantity + 1} : item
      ) as any);
    } else {
      setCart([...cart, {...product, quantity: 1}] as any);
    }
    
    // Show the "Added to Cart" animation
    setAddedToCart(product.id);
    setTimeout(() => {
      setAddedToCart(null);
    }, 2000);
  };

  // Update quantity in cart
  const updateQuantity = (productId: any, newQuantity: any) => {
    if (newQuantity <= 0) {
      setCart(cart.filter((item: any) => item.id !== productId));
    } else {
      setCart(cart.map((item: any) => 
        item.id === productId ? {...item, quantity: newQuantity} : item
      ) as any);
    }
  };

  // Remove item from cart
  const removeFromCart = (productId: any) => {
    setCart(cart.filter((item: any) => item.id !== productId));
  };

  // Handle phone submit
  const handlePhoneSubmit = (e: any) => {
    e.preventDefault();
    if (phoneNumber) {
      setOtpSent(true);
      setCurrentPage('otp-verification');
    }
  };
  
  // Handle OTP verification
  const handleOtpVerification = (e: any) => {
    e.preventDefault();
    if (otpInput) {
      // In a real app, we would verify the OTP here
      // For this demo, we'll just take the phone number as the user name
      setUserName("User_" + phoneNumber.substring(phoneNumber.length - 4));
      setCurrentPage('products');
    }
  };

  // Handle checkout
  const handleCheckout = () => {
    if (cart.length > 0) {
      setCurrentPage('checkout');
    }
  };

  // Place order
  const placeOrder = (e: any) => {
    e.preventDefault();
    if (address) {
      setOrderPlaced(true);
      setTimeout(() => {
        setCart([]);
        setOrderPlaced(false);
        setCurrentPage('products');
      }, 3000);
    }
  };

  // Placeholder image component with colored backgrounds
  const ProductImage = ({ type, className }: any) => {
    const colors: any = {
      headphones: 'bg-purple-100',
      smartwatch: 'bg-blue-100',
      speaker: 'bg-green-100',
      charger: 'bg-amber-100',
      stand: 'bg-rose-100',
      usbhub: 'bg-cyan-100'
    };

    const icons: any = {
      headphones: '🎧',
      smartwatch: '⌚',
      speaker: '🔊',
      charger: '🔌',
      stand: '📱',
      usbhub: '🔄'
    };

    return (
      <div className={`${colors[type]} ${className} flex items-center justify-center rounded-md`}>
        <span className="text-6xl">{icons[type]}</span>
      </div>
    );
  };

  // Phone Login Page
  const PhoneLoginPage = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">TechShop</h1>
          <p className="text-gray-600">Login with your phone number</p>
        </div>
        
        <form onSubmit={handlePhoneSubmit}>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="phone">
              Phone Number
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-r-0 border-gray-300 rounded-l-md">
                +91
              </span>
              <input
                id="phone"
                type="tel"
                value={phoneNumber}
                autoFocus
                onChange={(e) => {
                  // Only allow numbers
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 10) {
                    setPhoneNumber(value);
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your 10-digit number"
                maxLength={10}
                required
              />
            </div>
          </div>
          
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md"
          >
            Send OTP
          </button>
        </form>
      </div>
    </div>
  );
  
  // OTP Verification Page
  const OtpVerificationPage = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Verify OTP</h1>
          <p className="text-gray-600">
            We sent a verification code to <span className="font-medium">+91 {phoneNumber}</span>
          </p>
        </div>
        
        <form onSubmit={handleOtpVerification}>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="otp">
              OTP
            </label>
            <input
              id="otp"
              type="text"
              value={otpInput}
              autoFocus
              onChange={(e) => {
                // Only allow up to 6 digits
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= 6) {
                  setOtpInput(value);
                }
              }}
              className="w-full px-4 py-2 text-center text-2xl tracking-widest border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="• • • • • •"
              maxLength={6}
              required
            />
            <p className="mt-2 text-sm text-gray-500 text-center">
              For demo purposes, enter any 6 digits
            </p>
          </div>
          
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md"
          >
            Verify & Continue
          </button>
          
          <button
            type="button"
            onClick={() => setCurrentPage('phone-login')}
            className="w-full mt-4 py-2 px-4 bg-white border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50"
          >
            Back to Phone Number
          </button>
        </form>
      </div>
    </div>
  );

  // Products Page
  const ProductsPage = () => (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Our Products</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map(product => (
          <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
            <div 
              onClick={() => {
                setSelectedProduct(product as any);
                setCurrentPage('product-detail');
              }}
              className="cursor-pointer"
            >
              <ProductImage type={product.image} className="h-48 w-full" />
              
              <div className="p-4">
                <h2 className="text-xl font-semibold mb-2">{product.name}</h2>
                <p className="text-gray-600 mb-4">{product.description}</p>
                
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">${product.price}</span>
                </div>
              </div>
            </div>
            
            <div className="px-4 pb-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addToCart(product);
                }}
                className="w-full py-2 px-4 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 transition duration-200 relative overflow-hidden"
              >
                {addedToCart === product.id ? (
                  <span className="flex items-center justify-center">
                    <CheckCircle className="mr-2" size={16} />
                    Added to Cart!
                  </span>
                ) : (
                  "Add to Cart"
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  
  // Product Detail Page
  const ProductDetailPage = () => {
    if (!selectedProduct) return null;
    
    return (
      <div className="container mx-auto px-4 py-8">
        <button 
          onClick={() => setCurrentPage('products')}
          className="mb-6 flex items-center text-blue-600 hover:text-blue-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Products
        </button>
        
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="md:flex">
            <div className="md:w-1/2">
              <ProductImage type={selectedProduct.image} className="h-96 w-full" />
            </div>
            
            <div className="md:w-1/2 p-6">
              <h1 className="text-3xl font-bold mb-4">{selectedProduct.name}</h1>
              <div className="flex items-center mb-4">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="ml-2 text-gray-600">4.9 (120 reviews)</span>
              </div>
              
              <p className="text-4xl font-bold text-blue-600 mb-6">${selectedProduct.price}</p>
              
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">Description</h2>
                <p className="text-gray-700">{selectedProduct.description}</p>
              </div>
              
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">Key Features</h2>
                <ul className="list-disc list-inside text-gray-700">
                  <li>Premium quality materials</li>
                  <li>1-year warranty</li>
                  <li>Free shipping worldwide</li>
                  <li>30-day money-back guarantee</li>
                </ul>
              </div>
              
              <div className="flex space-x-4">
                <button
                  onClick={() => addToCart(selectedProduct)}
                  className="flex-1 py-3 px-6 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 transition duration-200 flex items-center justify-center"
                >
                  {addedToCart === selectedProduct.id ? (
                    <span className="flex items-center justify-center">
                      <CheckCircle className="mr-2" size={16} />
                      Added to Cart!
                    </span>
                  ) : (
                    <span className="flex items-center">
                      Add to Cart
                    </span>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    addToCart(selectedProduct);
                    setCurrentPage('cart');
                  }}
                  className="flex-1 py-3 px-6 bg-gray-800 text-white rounded-md hover:bg-gray-900"
                >
                  Buy Now
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-6 border-t border-gray-200">
            <h2 className="text-2xl font-bold mb-4">Product Specifications</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-700">Dimensions</h3>
                <p>10 × 5 × 2 cm</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-700">Weight</h3>
                <p>150g</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-700">Material</h3>
                <p>Aluminum, Plastic</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-700">Color Options</h3>
                <p>Black, Silver, Gold</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Cart Component
  const CartComponent = () => (
    <div className="fixed inset-y-0 right-0 max-w-md w-full bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-30">
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Your Cart</h2>
            <button
              onClick={() => setCurrentPage('products')}
              className="text-gray-500 hover:text-gray-700"
            >
              &times;
            </button>
          </div>
        </div>
        
        <div className="flex-grow overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <ShoppingCart size={48} className="mb-4" />
              <p>Your cart is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item: any) => (
                <div key={item.id} className="flex border-b border-gray-100 pb-4">
                  <ProductImage type={item.image} className="h-16 w-16 rounded" />
                  
                  <div className="ml-4 flex-grow">
                    <div className="flex justify-between">
                      <h3 className="font-medium">{item.name}</h3>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        &times;
                      </button>
                    </div>
                    
                    <p className="text-gray-600">${item.price}</p>
                    
                    <div className="flex items-center mt-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="bg-gray-200 rounded-l px-2 py-1"
                      >
                        -
                      </button>
                      <span className="bg-gray-100 px-4 py-1">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="bg-gray-200 rounded-r px-2 py-1"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200">
          <div className="flex justify-between mb-4">
            <span className="font-medium">Total:</span>
            <span className="font-bold">${cartTotal.toFixed(2)}</span>
          </div>
          
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={`w-full py-2 px-4 rounded-md font-medium ${
              cart.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Checkout
          </button>
        </div>
      </div>
    </div>
  );

  // Checkout Page
  const CheckoutPage = () => (
    <div className="container mx-auto px-4 py-8 max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Order Summary</h2>
        
        <div className="space-y-3 mb-4">
          {cart.map((item: any) => (
            <div key={item.id} className="flex justify-between">
              <span>{item.name} x {item.quantity}</span>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
        
        <div className="border-t border-gray-200 pt-3 mt-3">
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>${cartTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-medium mb-4">Shipping Information</h2>
        
        <form onSubmit={placeOrder}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Name
            </label>
            <input
              type="text"
              value={userName}
              readOnly
              className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-md"
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onBlur={(e) => e.target.focus()} // Keep focus on this field
              autoFocus
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your full address"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md"
          >
            Place Order
          </button>
        </form>
      </div>
    </div>
  );

  // Header Component
  const Header = () => (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center" onClick={() => setCurrentPage('products')} style={{cursor: 'pointer'}}>
            <Laptop className="text-blue-600" />
            <h1 className="ml-2 text-xl font-bold">TechShop</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {currentPage !== 'login' && currentPage !== 'cart' && (
              <>
              <div className="flex items-center text-gray-700">
                  <User size={20} />
                  <span className="ml-2">{userName}</span>
                </div>
                <button
                  onClick={() => setCurrentPage('cart')}
                  className="flex items-center font-bold py-2 px-4 text-gray-700 font-medium"
                >
                  <span>My Cart</span>
                  {cart.length > 0 && (
                    <span className="ml-2 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {cart.reduce((total, item: any) => total + item.quantity, 0)}
                    </span>
                  )}
                </button>
                
                
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );

  // Order Confirmation Alert
  const OrderConfirmation = () => (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <Alert className="max-w-md w-full bg-white p-6 rounded-lg shadow-lg">
        <CheckCircle className="h-6 w-6 text-green-500" />
        <AlertTitle className="text-xl font-semibold mt-2">Order Placed!</AlertTitle>
        <AlertDescription>
          Thank you {userName} for placing your order. We will process it right away!
        </AlertDescription>
      </Alert>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {!['phone-login', 'otp-verification'].includes(currentPage) && <Header />}
      
      {currentPage === 'phone-login' && <PhoneLoginPage />}
      {currentPage === 'otp-verification' && <OtpVerificationPage />}
      {currentPage === 'products' && <ProductsPage />}
      {currentPage === 'product-detail' && <ProductDetailPage />}
      {currentPage === 'cart' && <CartComponent />}
      {currentPage === 'checkout' && <CheckoutPage />}
      
      {orderPlaced && <OrderConfirmation />}
    </div>
  );
};

export default EcommerceApp;