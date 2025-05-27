
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useModalManager } from '@/hooks/use-modal-manager';
import EnhancedUsernameRegistration from './EnhancedUsernameRegistration';

interface UsernameWalletModalProps {
  open: boolean;
  onClose: () => void;
}

const UsernameWalletModal = ({ open, onClose }: UsernameWalletModalProps) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Use the modal manager to handle closing during transactions
  const { shouldBeOpen } = useModalManager('username-wallet-modal', open, onClose);

  const handleComplete = () => {
    onClose();
    navigate('/app');
  };

  return (
    <Dialog open={shouldBeOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={isMobile ? "sm:max-w-[92%] w-[92%] mx-auto rounded-xl p-0 overflow-hidden" : "p-0 overflow-hidden max-w-md"}>
        <EnhancedUsernameRegistration onComplete={handleComplete} />
      </DialogContent>
    </Dialog>
  );
};

export default UsernameWalletModal;
