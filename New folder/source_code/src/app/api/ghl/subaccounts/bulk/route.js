import GHLClient from '../../../../lib/ghl-client';

export async function POST(req) {
  const { accounts } = await req.json();

  if (!Array.isArray(accounts) || accounts.length === 0) {
    return Response.json({
      success: false,
      message: 'Accounts array is required and cannot be empty'
    }, { status: 400 });
  }

  const ghlClient = new GHLClient();
  const results = [];
  const errors = [];

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    
    try {
      const result = await ghlClient.createSubAccount(account);
      
      if (result.success) {
        results.push({
          index: i,
          success: true,
          data: result.data,
          locationId: result.locationId,
          businessName: account.businessName
        });
      } else {
        errors.push({
          index: i,
          success: false,
          error: result.error,
          businessName: account.businessName
        });
      }
    } catch (error) {
      errors.push({
        index: i,
        success: false,
        error: error.message,
        businessName: account.businessName
      });
    }

    // Add delay between requests to avoid rate limiting
    if (i < accounts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return Response.json({
    success: true,
    message: `Processed ${accounts.length} accounts`,
    results: {
      successful: results.length,
      failed: errors.length,
      total: accounts.length
    },
    data: {
      successful: results,
      failed: errors
    }
  }, { status: 200 });
}
