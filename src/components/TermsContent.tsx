// 純靜態內容，修訂時直接編輯此檔
export default function TermsContent() {
  return (
    <>
      <h1 className="font-display text-2xl text-scoreboard">網站規定與免責聲明</h1>
      <p className="mt-2 text-xs text-dugout">最後更新：2026 年 7 月 19 日</p>

      <section className="mt-8">
        <h2 className="font-display text-lg text-scoreboard">網站規定</h2>

        <h3 className="mt-5 font-bold text-scoreboard">一、平台性質</h3>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-dugout">
          <li>本質球迷交易所（下稱「本站」）為球迷之間的資訊交流平台，僅提供刊登與聯繫功能。所有交易由買賣雙方自行接洽完成，本站不經手任何金流、票券或商品。</li>
          <li>本站為球迷自發經營，與中華職棒大聯盟及各球團無任何關聯。</li>
          <li>未滿 18 歲者，應經法定代理人（家長或監護人）閱讀本規定並同意後，方得註冊及使用本站服務。</li>
        </ol>

        <h3 className="mt-5 font-bold text-scoreboard">二、刊登規範</h3>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-dugout">
          <li>
            球票僅限<strong className="text-scoreboard">原價（含）以下</strong>轉讓。依《運動產業發展條例》規定，超過原價轉售運動賽事門票可處票面金額 10 至 50 倍罰鍰，以虛偽資料購票轉售者最高可處三年以下有期徒刑。禁止任何形式的加價、變相加價（如高價「運費」、綁售）行為。
          </li>
          <li>刊登內容必須真實：票券場次、座位、價格與商品狀況需如實填寫，票券需附照片。</li>
          <li>禁止刊登：偽造票券、來路不明的商品、仿冒品、與棒球無關的商品。</li>
          <li>同一票券/商品請勿重複刊登，售出後請儘速標記「已售出」。</li>
          <li>球票刊登於所有場次的比賽日結束後將自動下架，不另行通知；已下架的刊登仍可在會員中心查看。</li>
        </ol>

        <h3 className="mt-5 font-bold text-scoreboard">三、交易行為</h3>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-dugout">
          <li>交易完成後，請雙方於私訊中按下「確認交易完成」，累積信用星星。</li>
          <li>成交次數與星等評價僅供參考。為維護信譽制度的真實性，系統會依對話內容與交易情形判定是否計入；異常或重複的交易（例如刷量、互刷評價）將不予計入，情節重大者得停權處理。判定標準不對外公開，亦不接受申訴補計。</li>
          <li>禁止在交易過程中騷擾、辱罵、詐欺對方。</li>
          <li>會員個人聯絡資訊請透過站內私訊交換，本站不對站外聯繫產生的糾紛負責。</li>
        </ol>

        <h3 className="mt-5 font-bold text-scoreboard">四、帳號管理</h3>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-dugout">
          <li>違反上述規定者，本站得視情節輕重刪除刊登、限制功能或永久停權，不另行通知。</li>
          <li>涉及詐欺或違法行為者，本站將配合司法機關提供相關紀錄。</li>
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-lg text-scoreboard">免責聲明</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-dugout">
          <li>
            <strong className="text-scoreboard">交易風險自負</strong>：本站僅提供資訊刊登平台，不參與、不擔保任何交易。票券真偽、商品狀況、付款與交付方式，請買賣雙方自行確認。因交易產生的任何糾紛或損失，本站不負賠償責任。
          </li>
          <li>
            <strong className="text-scoreboard">防詐提醒</strong>：請優先選擇面交並當場驗票。切勿在未取得票券前先行付款給陌生賣家；電子票券請確認可正常轉移後再完成交易。
          </li>
          <li>
            <strong className="text-scoreboard">內容責任</strong>：刊登內容由會員自行發布，其真實性與合法性由發布者自負。本站發現違規內容得逕行移除。
          </li>
          <li>
            <strong className="text-scoreboard">個人資料</strong>：本站依《個人資料保護法》蒐集、處理及利用你的個人資料，說明如下：
            <ul className="mt-1.5 list-disc space-y-1 pl-5">
              <li>蒐集目的：提供會員註冊、刊登、站內私訊、信譽評價等本站服務，以及必要的帳號與安全管理。</li>
              <li>資料類別：電子郵件、暱稱、頭像、刊登內容、站內訊息與交易紀錄。</li>
              <li>利用期間與方式：於會員資格存續期間內，在提供上述服務的必要範圍內利用；本站不會將資料提供給第三方，法律要求或配合司法機關者除外。</li>
              <li>當事人權利：你得依《個資法》第 3 條請求查詢、閱覽、補充、更正或刪除你的個人資料，或請求停止蒐集、處理、利用；請透過站內聯絡方式提出。</li>
              <li>刪除帳號後，本站將刪除或去識別化你的個人資料，但為處理糾紛或依法留存的紀錄不在此限。</li>
            </ul>
          </li>
          <li>
            <strong className="text-scoreboard">服務變更</strong>：本站得隨時修改、暫停或終止服務。規定修訂後將公告於本頁，繼續使用即視為同意。
          </li>
        </ol>
      </section>
    </>
  )
}
