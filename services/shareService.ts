
import { db } from '../config/firebase';
import { 
    collection, 
    addDoc, 
    getDoc, 
    doc, 
    serverTimestamp, 
    updateDoc, 
    arrayUnion, 
    setDoc, 
    query, 
    where, 
    getDocs,
    deleteDoc
} from 'firebase/firestore';
import { FrameConfig, SavedDesign, Collaborator } from '../types';

export const saveSharedDesign = async (config: FrameConfig, createdBy: string) => {
    try {
        const docRef = await addDoc(collection(db, 'shared_designs'), {
            config,
            createdBy,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error saving shared design:", error);
        return null;
    }
};

export const getSharedDesign = async (designId: string) => {
    try {
        const docSnap = await getDoc(doc(db, 'shared_designs', designId));
        if (docSnap.exists()) {
            return docSnap.data().config as FrameConfig;
        }
        return null;
    } catch (error) {
        console.error("Error getting shared design:", error);
        return null;
    }
};

export const saveCTVDesign = async (ctvUid: string, name: string, config: FrameConfig) => {
    try {
        const designId = Math.random().toString(36).substring(2, 15);
        const newDesign: SavedDesign = {
            id: designId,
            ctvUid,
            name,
            config,
            createdAt: Date.now()
        };
        
        // Primary Attempt: Save inside collaborators document
        try {
            await setDoc(doc(db, 'collaborators', ctvUid), {
                designs: arrayUnion(newDesign)
            }, { merge: true });
            console.log("CTV design saved successfully in collaborators collection");
            return designId;
        } catch (collabError: any) {
            console.warn("Could not save to collaborators document, trying ctv_designs collection:", collabError.message);
            
            // Secondary Attempt: Save as standalone document in ctv_designs
            const docRef = await addDoc(collection(db, 'ctv_designs'), {
                ctvUid,
                name,
                config,
                createdAt: Date.now()
            });
            console.log("CTV design saved successfully in ctv_designs collection");
            return docRef.id;
        }
    } catch (error: any) {
        console.error("Critical error in saveCTVDesign:", error);
        // Throw the error so the caller can handle it or show specific feedback
        throw error;
    }
};

export const getCTVDesigns = async (ctvUid: string): Promise<SavedDesign[]> => {
    try {
        console.log("Fetching designs for CTV:", ctvUid);
        const docSnap = await getDoc(doc(db, 'collaborators', ctvUid));
        if (docSnap.exists()) {
            const data = docSnap.data() as Collaborator;
            if (data.designs) {
                return data.designs.sort((a, b) => b.createdAt - a.createdAt);
            }
        }
        
        // Fallback to ctv_designs collection - wrap in try-catch to avoid surfacing permission errors
        // if the collection rules aren't deployed
        try {
            // Remove orderBy to avoid index requirement in fallback
            const q = query(
                collection(db, 'ctv_designs'),
                where('ctvUid', '==', ctvUid)
            );
            const querySnapshot = await getDocs(q);
            const designs: SavedDesign[] = [];
            querySnapshot.forEach((doc) => {
                designs.push({ id: doc.id, ...doc.data() } as SavedDesign);
            });
            // Sort in memory
            return designs.sort((a, b) => b.createdAt - a.createdAt);
        } catch (fallbackError) {
            console.warn("Fallback getCTVDesigns failed (likely permissions or missing collection):", fallbackError);
            return [];
        }
    } catch (error) {
        console.error("Error getting CTV designs (primary):", error);
        return [];
    }
};

export const deleteCTVDesign = async (designId: string, ctvUid?: string) => {
    try {
        if (ctvUid) {
            const docRef = doc(db, 'collaborators', ctvUid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as Collaborator;
                if (data.designs) {
                    const updatedDesigns = data.designs.filter(d => d.id !== designId);
                    await updateDoc(docRef, { designs: updatedDesigns });
                    return true;
                }
            }
        }
        
        // Fallback/Legacy delete - wrap in try-catch
        try {
            await deleteDoc(doc(db, 'ctv_designs', designId));
            return true;
        } catch (fallbackError) {
            console.warn("Fallback deleteCTVDesign failed:", fallbackError);
            return false;
        }
    } catch (error) {
        console.error("Error deleting CTV design:", error);
        return false;
    }
};

export const getCollaboratorByReferralCode = async (referralCode: string): Promise<Collaborator | null> => {
    try {
        const q = query(
            collection(db, 'collaborators'),
            where('referralCode', '==', referralCode)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].data() as Collaborator;
        }
        
        // Also check by phone just in case
        const q2 = query(
            collection(db, 'collaborators'),
            where('phone', '==', referralCode)
        );
        const querySnapshot2 = await getDocs(q2);
        if (!querySnapshot2.empty) {
            return querySnapshot2.docs[0].data() as Collaborator;
        }
        
        return null;
    } catch (error) {
        console.error("Error getting collaborator by referral code:", error);
        return null;
    }
};
