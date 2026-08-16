import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { registerLoanPurchasesListener } from '@/lib/cacheEvents'
import { enrichLoanPurchase, getLoanDeadlines, roundMoney } from '@/lib/loanInstallments'
import { supabase } from '@/lib/supabase'
import type { LoanPaymentAllocation, LoanPurchase } from '@/types'

export interface CreateLoanPurchaseValues {
  account_id: string
  category_id: string | null
  name: string
  principal_amount: number
  term_months: number
  monthly_interest_rate: number
  monthly_installment: number
  opening_installments_paid: number
  opening_paid_amount: number
  first_due_date: string
  notes: string | null
}

export type UpdateLoanPurchaseValues = Omit<CreateLoanPurchaseValues, 'account_id'>

export function useLoanPurchases(accountId?: string, enabled = true) {
  const { user } = useAuth()
  const userId = user?.id
  const [purchases, setPurchases] = useState<LoanPurchase[]>([])
  const [allocations, setAllocations] = useState<LoanPaymentAllocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!userId || !enabled) {
      setPurchases([])
      setAllocations([])
      setLoading(false)
      return
    }

    setLoading(true)
    let purchaseQuery = supabase
      .from('loan_purchases')
      .select('*, category:categories(id, name, color, icon)')
      .eq('user_id', userId)

    if (accountId) purchaseQuery = purchaseQuery.eq('account_id', accountId)

    const { data: purchaseRows, error: purchaseError } = await purchaseQuery
      .order('first_due_date', { ascending: true })
      .order('created_at', { ascending: true })

    if (purchaseError) {
      setError(purchaseError.message)
      setLoading(false)
      return
    }

    const nextPurchases = (purchaseRows as LoanPurchase[]) ?? []
    const purchaseIds = nextPurchases.map((purchase) => purchase.id)
    let nextAllocations: LoanPaymentAllocation[] = []

    if (purchaseIds.length > 0) {
      const { data: allocationRows, error: allocationError } = await supabase
        .from('loan_payment_allocations')
        .select('*, transaction:transactions(id, date, description)')
        .eq('user_id', userId)
        .in('loan_purchase_id', purchaseIds)
        .order('created_at', { ascending: true })

      if (allocationError) {
        setError(allocationError.message)
        setLoading(false)
        return
      }
      nextAllocations = (allocationRows as LoanPaymentAllocation[]) ?? []
    }

    setPurchases(nextPurchases)
    setAllocations(nextAllocations)
    setError(null)
    setLoading(false)
  }, [accountId, enabled, userId])

  useEffect(() => {
    queueMicrotask(() => { void fetch() })
  }, [fetch])

  useEffect(() => registerLoanPurchasesListener(() => { void fetch() }), [fetch])

  const createPurchase = async (values: CreateLoanPurchaseValues) => {
    if (!userId) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to add a financed purchase.' }

    const totalPayable = roundMoney(values.monthly_installment * values.term_months)
    const { error: insertError } = await supabase.from('loan_purchases').insert({
      ...values,
      total_payable: totalPayable,
      user_id: userId,
    })
    if (insertError) return { error: insertError.message }

    await fetch()
    return { error: null }
  }

  const updatePurchase = async (id: string, values: UpdateLoanPurchaseValues) => {
    if (!userId) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to edit a financed purchase.' }

    const purchase = purchases.find((item) => item.id === id)
    if (!purchase) return { error: 'Financed purchase not found' }
    const allocatedPayments = allocations
      .filter((allocation) => allocation.loan_purchase_id === id)
      .reduce((sum, allocation) => sum + allocation.amount, 0)
    const totalPayable = roundMoney(values.monthly_installment * values.term_months)
    if (values.opening_paid_amount + allocatedPayments > totalPayable) {
      return { error: 'Total payable cannot be lower than the amount already paid.' }
    }

    const { error: updateError } = await supabase
      .from('loan_purchases')
      .update({ ...values, total_payable: totalPayable })
      .eq('id', id)
      .eq('user_id', userId)
    if (updateError) return { error: updateError.message }

    await fetch()
    return { error: null }
  }

  const deletePurchase = async (id: string) => {
    if (!userId) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to remove a financed purchase.' }
    const { error: deleteError } = await supabase
      .from('loan_purchases')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    if (deleteError) return { error: deleteError.message }

    await fetch()
    return { error: null }
  }

  const enrichedPurchases = useMemo(
    () => purchases.map((purchase) => enrichLoanPurchase(purchase, allocations)),
    [allocations, purchases],
  )
  const deadlines = useMemo(
    () => getLoanDeadlines(purchases, allocations),
    [allocations, purchases],
  )

  return {
    purchases: enrichedPurchases,
    allocations,
    deadlines,
    loading,
    error,
    refetch: fetch,
    createPurchase,
    updatePurchase,
    deletePurchase,
  }
}
