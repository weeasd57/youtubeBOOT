import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { supabaseAdmin } from '@/utils/supabase-server';

// API route to manage account members and roles for a specific account

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.authUserId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const authUserId = session.authUserId;
    const accountId = params.id; // Get account ID from the URL parameters

    if (!accountId) {
        return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    console.log(`API route /api/accounts/[id]/members: Fetching members for Account ID: ${accountId} by user ${authUserId}`);

    // TODO: Implement logic to verify if the authenticated user has permission to view members of this account
    // This should involve checking the 'account_roles' table or if the user is the account owner.
    // For now, we'll assume the user has access if they are authenticated.

    // Fetch account members and their roles
    // Assuming account_roles table exists and links accounts, users (auth.users), and roles
    const { data: members, error } = await supabaseAdmin
        .from('account_roles')
        .select(`
            user: auth_users ( id, email, raw_user_meta_data ), // Join with auth.users table
            role: roles ( id, name ) // Join with roles table
        `)
        .eq('account_id', accountId);

    if (error) {
        console.error('API route /api/accounts/[id]/members: Supabase error fetching members:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`API route /api/accounts/[id]/members: Found ${members?.length || 0} members for account ${accountId}`);

    // Format the output to be more user-friendly
    const formattedMembers = members.map(member => ({
        user_id: member.user.id,
        email: member.user.email,
        name: member.user.raw_user_meta_data?.full_name || member.user.email,
        role: member.role.name
    }));


    return NextResponse.json(formattedMembers || []);

  } catch (error) {
    console.error('API route /api/accounts/[id]/members: Unexpected error in GET handler:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.authUserId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const authUserId = session.authUserId;
        const accountId = params.id; // Get account ID from the URL parameters
        const body = await request.json();
        const { email, roleId } = body; // Required: email of the user to invite, role ID

        if (!accountId || !email || !roleId) {
            return NextResponse.json({ error: 'Account ID, email, and role ID are required' }, { status: 400 });
        }

        console.log(`API route /api/accounts/[id]/members: User ${authUserId} inviting ${email} to account ${accountId} with role ${roleId}`);

        // TODO: Implement logic to verify if the authenticated user has permission to invite members to this account and assign the specified role.
        // This would involve checking the inviter's role in 'account_roles' for this account
        // and comparing it against required permissions.

        // Find the invited user in auth.users by email
        const { data: invitedUser, error: fetchUserError } = await supabaseAdmin.auth.admin.getUserByEmail(email);

        if (fetchUserError || !invitedUser?.user) {
            console.warn(`API route /api/accounts/[id]/members: Invited user with email ${email} not found in auth.users.`);
            // TODO: Implement invitation email logic if user not found
            return NextResponse.json({ error: 'Invited user not found. They need to sign up first.' }, { status: 404 });
        }

        const invitedAuthUserId = invitedUser.user.id;

        // Check if the user is already a member of this account
        const { count: existingMembershipCount, error: checkMembershipError } = await supabaseAdmin
            .from('account_roles')
            .select('account_id', { count: 'exact', head: true })
            .eq('account_id', accountId)
            .eq('user_id', invitedAuthUserId);

        if (checkMembershipError) {
             console.error('API route /api/accounts/[id]/members: Error checking existing membership:', checkMembershipError);
             return NextResponse.json({ error: 'Error checking existing membership' }, { status: 500 });
        }

        if (existingMembershipCount > 0) {
            console.warn(`API route /api/accounts/[id]/members: User ${email} is already a member of account ${accountId}.`);
            return NextResponse.json({ error: 'User is already a member of this account' }, { status: 409 }); // Conflict
        }

        // TODO: Verify if the roleId exists in the 'roles' table.

        // Insert the new member into the 'account_roles' table
        const { data: newMembership, error: insertMembershipError } = await supabaseAdmin
            .from('account_roles')
            .insert([{
                account_id: accountId,
                user_id: invitedAuthUserId,
                role_id: roleId,
                assigned_by: authUserId // Record who assigned the role
            }])
            .select()
            .single();

        if (insertMembershipError) {
            console.error('API route /api/accounts/[id]/members: Supabase error adding member:', insertMembershipError);
            return NextResponse.json({ error: insertMembershipError.message }, { status: 500 });
        }

        console.log(`API route /api/accounts/[id]/members: User ${email} added to account ${accountId} with role ${roleId}.`);

        // TODO: Return more detailed information about the new member if needed

        return NextResponse.json({ message: 'Member added successfully', membership: newMembership }, { status: 201 });
    
        } catch (error) {
            console.error('API route /api/accounts/[id]/members: Unexpected error during member invitation:', error);
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }
    }
    
    export async function PUT(request, { params }) {
        try {
            const session = await getServerSession(authOptions);
    
            if (!session || !session.authUserId) {
                return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
            }
    
            const authUserId = session.authUserId;
            const accountId = params.id; // Get account ID from the URL parameters
            const body = await request.json();
            const { userId, roleId } = body; // Required: user ID to update, new role ID
    
            if (!accountId || !userId || !roleId) {
                return NextResponse.json({ error: 'Account ID, user ID, and role ID are required' }, { status: 400 });
            }
    
            console.log(`API route /api/accounts/[id]/members: User ${authUserId} updating role for user ${userId} in account ${accountId} to role ${roleId}`);
    
            // TODO: Implement logic to verify if the authenticated user has permission to update roles in this account and assign the specified role.
            // This would involve checking the updater's role in 'account_roles' for this account
            // and comparing it against required permissions. Also, prevent updating roles of users with higher or equal roles.
    
            // TODO: Verify if the roleId exists in the 'roles' table.
    
            // Update the role in the 'account_roles' table
            const { data: updatedMembership, error: updateMembershipError } = await supabaseAdmin
                .from('account_roles')
                .update({ role_id: roleId, assigned_by: authUserId, assigned_at: new Date().toISOString() }) // Record who updated the role and when
                .eq('account_id', accountId)
                .eq('user_id', userId)
                .select()
                .single();
    
            if (updateMembershipError) {
                console.error('API route /api/accounts/[id]/members: Supabase error updating member role:', updateMembershipError);
                return NextResponse.json({ error: updateMembershipError.message }, { status: 500 });
            }
    
            if (!updatedMembership) {
                 console.warn(`API route /api/accounts/[id]/members: Membership not found for user ${userId} in account ${accountId}.`);
                 return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
            }
    
            console.log(`API route /api/accounts/[id]/members: Role updated for user ${userId} in account ${accountId} to role ${roleId}.`);
    
            // TODO: Return more detailed information about the updated member if needed
    
            return NextResponse.json({ message: 'Member role updated successfully', membership: updatedMembership }, { status: 200 });
    
        } catch (error) {
            console.error('API route /api/accounts/[id]/members: Unexpected error during role update:', error);
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }
    }

    
    
    // TODO: Implement DELETE handler for removing members

    export async function DELETE(request, { params }) {
        try {
            const session = await getServerSession(authOptions);

            if (!session || !session.authUserId) {
                return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
            }

            const authUserId = session.authUserId;
            const accountId = params.id; // Get account ID from the URL parameters
            const { searchParams } = new URL(request.url);
            const userId = searchParams.get('userId'); // User ID to remove

            if (!accountId || !userId) {
                return NextResponse.json({ error: 'Account ID and user ID are required' }, { status: 400 });
            }

            console.log(`API route /api/accounts/[id]/members: User ${authUserId} removing user ${userId} from account ${accountId}`);

            // TODO: Implement logic to verify if the authenticated user has permission to remove members from this account.
            // This would involve checking the remover's role in 'account_roles' for this account
            // and comparing it against required permissions. Also, prevent removing the account owner or users with higher roles.

            // Delete the record from the 'account_roles' table
            const { error: deleteError, count } = await supabaseAdmin
                .from('account_roles')
                .delete()
                .eq('account_id', accountId)
                .eq('user_id', userId)
                .select(); // Select to check if any rows were deleted

            if (deleteError) {
                console.error('API route /api/accounts/[id]/members: Supabase error removing member:', deleteError);
                return NextResponse.json({ error: deleteError.message }, { status: 500 });
            }

            // Check if any rows were actually deleted and return 404 if not found
            if (!count || count === 0) {
                 console.warn(`API route /api/accounts/[id]/members: Membership not found for user ${userId} in account ${accountId}.`);
                 return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
            }


            console.log(`API route /api/accounts/[id]/members: User ${userId} removed from account ${accountId}.`);

            return NextResponse.json({ message: 'Member removed successfully' }, { status: 200 });

        } catch (error) {
            console.error('API route /api/accounts/[id]/members: Unexpected error during member removal:', error);
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }
    }