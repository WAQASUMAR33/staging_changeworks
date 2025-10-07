import { prisma } from "../../lib/prisma"; // Adjust this import based on your structure
import { NextResponse } from "next/server";
import emailService from "../../lib/email-service";

// Helper function to create HTML response
function createHtmlResponse(title, message, isSuccess = true, email = null, note = null) {
  const icon = isSuccess ? '✅' : '❌';
  const bgColor = isSuccess ? 'from-blue-50 to-white' : 'from-red-50 to-white';
  const iconBg = isSuccess ? 'bg-gradient-to-r from-blue-100 to-purple-100' : 'bg-red-100';
  const textColor = isSuccess ? 'text-blue-700' : 'text-red-700';
  const buttonColor = isSuccess ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700' : 'bg-red-600 hover:bg-red-700';
  
  return new NextResponse(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - ChangeWorks Fund</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; }
        .gradient-bg { background: linear-gradient(135deg, ${isSuccess ? '#eff6ff 0%, #faf5ff 50%, #ffffff 100%' : '#fef2f2 0%, #ffffff 100%'}); }
        .card-shadow { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
        .animate-fade-in { animation: fadeIn 0.6s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-bounce-gentle { animation: bounceGentle 2s infinite; }
        @keyframes bounceGentle { 0%, 20%, 50%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-10px); } 60% { transform: translateY(-5px); } }
        .gradient-text { background: linear-gradient(135deg, #2563eb 0%, #9333ea 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
      </style>
    </head>
    <body class="min-h-screen gradient-bg flex items-center justify-center py-16 px-6">
      <div class="w-full max-w-2xl bg-white rounded-3xl card-shadow border border-gray-100 p-8 animate-fade-in">
        <div class="text-center">
          <div class="mx-auto mb-6 h-20 w-20 rounded-full ${iconBg} flex items-center justify-center animate-bounce-gentle">
            <span class="text-4xl">${icon}</span>
          </div>
          <h1 class="text-4xl font-bold ${isSuccess ? 'gradient-text' : textColor} mb-4">${title}</h1>
          <p class="text-lg text-gray-600 mb-6">
            ${email ? `Your email <span class="font-semibold text-gray-800">${email}</span> has been ${isSuccess ? 'verified' : 'could not be verified'}.</span>` : message}
          </p>
          
          ${note === 'email_not_sent' ? `
            <div class="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 inline-block">
              <strong>Note:</strong> Verification success email could not be sent, but you're all set!
            </div>
          ` : ''}
          
          <div class="mt-8 space-y-4">
            <a href="/login" class="inline-flex items-center px-8 py-4 ${buttonColor} text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
              </svg>
              Go to Login
            </a>
            
            ${!isSuccess ? `
              <div class="mt-4">
                <a href="/organization/signup" class="inline-flex items-center px-8 py-4 bg-gray-800 hover:bg-black text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                  </svg>
                  Sign Up Again
                </a>
              </div>
            ` : ''}
          </div>
          
          <div class="mt-8 pt-6 border-t border-gray-200">
            <div class="flex items-center justify-center space-x-4 text-sm text-gray-500">
              <div class="flex items-center">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
                <a href="mailto:info@rapidtechpro.com" class="hover:text-gray-700 transition-colors">info@rapidtechpro.com</a>
              </div>
              <div class="flex items-center">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                </svg>
                +923474308859
              </div>
            </div>
            <p class="mt-2 text-xs text-gray-400">ChangeWorks Fund - Your trusted platform partner for charitable giving</p>
          </div>
        </div>
      </div>
      
      <script>
        // Add some interactive effects
        document.addEventListener('DOMContentLoaded', function() {
          const card = document.querySelector('.animate-fade-in');
          card.style.opacity = '0';
          card.style.transform = 'translateY(20px)';
          
          setTimeout(() => {
            card.style.transition = 'all 0.6s ease-out';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, 100);
        });
      </script>
    </body>
    </html>
  `, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return createHtmlResponse(
        "Verification Failed", 
        "Verification token is missing. Please check your email for the correct verification link.",
        false
      );
    }

    const existingToken = await prisma.donorVerificationToken.findUnique({
      where: { token },
    });

    if (!existingToken) {
      return createHtmlResponse(
        "Verification Failed", 
        "This verification link is invalid or has already been used. Please request a new verification email.",
        false
      );
    }

    if (existingToken.expires < new Date()) {
      return createHtmlResponse(
        "Verification Failed", 
        "This verification link has expired. Please request a new verification email from your account settings.",
        false
      );
    }

    // Get donor information for email
    const donor = await prisma.donor.findUnique({
      where: { email: existingToken.identifier },
      include: {
        organization: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    if (!donor) {
      return createHtmlResponse(
        "Verification Failed", 
        "We could not find your account. Please contact support or try signing up again.",
        false
      );
    }

    // Mark donor as verified (set status true) and delete token in transaction
    await prisma.$transaction(async (tx) => {
      // Update donor status
      await tx.donor.update({
        where: { email: existingToken.identifier },
        data: {
          status: true, // assuming 'status' true means verified
        },
      });

      // Delete token after verification
      await tx.donorVerificationToken.delete({
        where: { token },
      });
    });

    // Send success verification email
    let emailSent = false;
    let emailError = null;

    try {
      if (process.env.EMAIL_SERVER_HOST && process.env.EMAIL_SERVER_USER && process.env.EMAIL_SERVER_PASSWORD) {
        const dashboardLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.changeworksfund.org'}/donor/dashboard?donor_id=${donor.id}`;
        
        const emailResult = await emailService.sendVerificationSuccessEmail({
          donor: {
            name: donor.name,
            email: donor.email
          },
          organization: donor.organization,
          dashboardLink: dashboardLink
        });

        if (emailResult.success) {
          emailSent = true;
          console.log('✅ Verification success email sent successfully');
        } else {
          emailError = emailResult.error;
          console.error('❌ Verification success email failed:', emailResult.error);
        }
      } else {
        console.log('⚠️ Email server not configured, skipping success email');
        emailError = 'Email server not configured';
      }
    } catch (emailErr) {
      emailError = emailErr.message;
      console.error('❌ Verification success email sending failed:', emailErr.message);
    }

    return createHtmlResponse(
      "Email Verified Successfully", 
      "Your email has been verified and your account is now active.",
      true,
      donor.email,
      !emailSent && emailError ? "email_not_sent" : null
    );
  } catch (error) {
    console.error("Verification error:", error);
    return createHtmlResponse(
      "Verification Failed", 
      "Something went wrong on our end. Please try again later or contact support if the problem persists.",
      false
    );
  }
}
