import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function POST(request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'No token provided',
        step: 'missing_token'
      }, { status: 401 });
    }

    console.log('Token received:', token.substring(0, 20) + '...');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded successfully:', decoded);

    return NextResponse.json({
      success: true,
      message: 'Token is valid',
      decoded: {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid token',
        step: 'invalid_token',
        details: error.message
      }, { status: 401 });
    }
    
    if (error.name === 'TokenExpiredError') {
      return NextResponse.json({ 
        success: false, 
        error: 'Token expired',
        step: 'expired_token',
        details: error.message
      }, { status: 401 });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Token verification failed',
      step: 'verification_error',
      details: error.message
    }, { status: 500 });
  }
}
