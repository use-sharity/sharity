"use client";

import { useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { ProfileSetupModal } from "./profile-setup-modal";

interface ProfileProviderProps {
	children: React.ReactNode;
}

export function ProfileProvider({ children }: ProfileProviderProps) {
	const { isSignedIn, isLoaded } = useAuth();
	const profile = useQuery(api.users.getMyProfile, isSignedIn ? {} : "skip");
	const [showSetupModal, setShowSetupModal] = useState(false);
	const [hasShownModal, setHasShownModal] = useState(false);

	useEffect(() => {
		// Show modal when:
		// 1. Auth is loaded
		// 2. User is signed in
		// 3. Profile query has returned
		// 4. User has no profile yet
		// 5. Haven't shown the modal in this session
		if (
			isLoaded &&
			isSignedIn &&
			profile !== undefined &&
			profile?.hasProfile === false &&
			!hasShownModal
		) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setShowSetupModal(true);
			setHasShownModal(true);
		}
	}, [isLoaded, isSignedIn, profile, hasShownModal]);

	// Reset hasShownModal when user signs out
	useEffect(() => {
		if (isLoaded && !isSignedIn) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setHasShownModal(false);
		}
	}, [isLoaded, isSignedIn]);

	return (
		<>
			{children}
			{profile && profile.clerkData && (
				<ProfileSetupModal
					open={showSetupModal}
					onOpenChange={setShowSetupModal}
					clerkData={profile.clerkData}
				/>
			)}
		</>
	);
}
