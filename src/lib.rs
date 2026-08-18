/// HashDrop Solana Program
/// 
/// This program provides on-chain storage for published content.
/// It implements the HashDrop protocol for decentralized publishing.
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    msg,
    program::invoke,
    program_error::ProgramError,
    pubkey::Pubkey,
};

use thiserror::Thiserror;

pub mod instruction;
pub mod state;

pub use instruction::*;

pub const PROGRAM_NAME: &str = "hashdrop";

error! {
    /// HashDrop Errors
    pub enum HashDropError {
        /// Invalid instruction data
        InvalidInstructionData,
        /// Invalid account data
        InvalidAccountData,
        /// Invalid creator signature
        InvalidCreator,
        /// Record already finalized
        RecordFinalized,
        /// Record not finalized
        RecordNotFinalized,
        /// Invalid chunk index
        InvalidChunkIndex,
        /// Chunk too large
        ChunkTooLarge,
        /// Insufficient lamports
        InsufficientLamports,
        /// Invalid PDA
        InvalidPDA,
    }
}

/// Process the instruction
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> Result<(), HashDropError> {
    msg!("HashDrop: Processing instruction");
    
    let instruction = HashDropInstruction::try_from_slice(instruction_data)?;
    
    match instruction {
        HashDropInstruction::CreateDrop { 
            hash, 
            content_size, 
            chunk_count, 
            content_type,
            bump 
        } => {
            msg!("HashDrop: Creating drop");
            // Implementation will go here
            process_create_drop(program_id, accounts, &hash, content_size, chunk_count, &content_type, bump)
        }
        HashDropInstruction::WriteChunk { 
            chunk_index, 
            chunk_data, 
            bump 
        } => {
            msg!("HashDrop: Writing chunk {}", chunk_index);
            process_write_chunk(program_id, accounts, chunk_index, &chunk_data, bump)
        }
        HashDropInstruction::FinalizeDrop { content_hash, bump } => {
            msg!("HashDrop: Finalizing drop");
            process_finalize_drop(program_id, accounts, &content_hash, bump)
        }
        HashDropInstruction::VerifyDrop { .. } => {
            msg!("HashDrop: Verifying drop");
            // Verification is done client-side
            Ok(())
        }
    }
}

// Placeholder functions - will be implemented in Phase 4
fn process_create_drop(
    _program_id: &Pubkey,
    _accounts: &[AccountInfo],
    _hash: &str,
    _content_size: u64,
    _chunk_count: u64,
    _content_type: &str,
    _bump: u8,
) -> Result<(), HashDropError> {
    // TODO: Implement Phase 4 create_drop instruction
    msg!("HashDrop: create_drop not yet implemented - Phase 4");
    Err(ProgramError::NotImplemented)
}

fn process_write_chunk(
    _program_id: &Pubkey,
    _accounts: &[AccountInfo],
    _chunk_index: u64,
    _chunk_data: &[u8],
    _bump: u8,
) -> Result<(), HashDropError> {
    // TODO: Implement Phase 4 write_chunk instruction
    msg!("HashDrop: write_chunk not yet implemented - Phase 4");
    Err(ProgramError::NotImplemented)
}

fn process_finalize_drop(
    _program_id: &Pubkey,
    _accounts: &[AccountInfo],
    _content_hash: &str,
    _bump: u8,
) -> Result<(), HashDropError> {
    // TODO: Implement Phase 4 finalize_drop instruction
    msg!("HashDrop: finalize_drop not yet implemented - Phase 4");
    Err(ProgramError::NotImplemented)
}