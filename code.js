// ... (بداية كود JavaScript وتهيئة Firebase وعناصر DOM تبقى كما هي) ...
// ... (دوال المصادقة وإعداد الملف الشخصي والتبويبات تبقى كما هي) ...

        // --- Chat View Logic ---
        function generateChatId(uid1, uid2) {
            // تأكد من أن uid1 هو الأصغر دائمًا لضمان معرف فريد ومتسق
            return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
        }

        function openChatView(chatPartner) { // chatPartner الآن يجب أن يحتوي على uid الطرف الآخر
            if (!currentUserData.uid || !chatPartner || !chatPartner.uid) {
                console.error("لا يمكن فتح الدردشة: بيانات المستخدم الحالي أو الطرف الآخر غير متوفرة.");
                alert("خطأ في فتح الدردشة.");
                showAppSection('chats-container'); // العودة لقائمة الدردشات
                return;
            }

            const chatId = generateChatId(currentUserData.uid, chatPartner.uid);
            currentChatInfo = {
                id: chatId, // هذا هو معرف مستند الدردشة في Firestore
                name: chatPartner.name || "مستخدم",
                avatar: chatPartner.avatar || "placeholder.png",
                partnerUid: chatPartner.uid // نحفظ uid الطرف الآخر
            };

            console.log("Opening chat with:", currentChatInfo.name, "Chat ID:", currentChatInfo.id);

            if(chatViewContactNameMainEl) chatViewContactNameMainEl.textContent = currentChatInfo.name;
            if(chatViewAvatarMainEl) chatViewAvatarMainEl.src = currentChatInfo.avatar;
            if(messagesContainerMain) messagesContainerMain.innerHTML = ''; // مسح الرسائل القديمة

            if (unsubscribeMessages) {
                console.log("Unsubscribing from previous chat listener.");
                unsubscribeMessages(); // إلغاء المستمع السابق
                unsubscribeMessages = null;
            }

            const messagesQuery = db.collection("chats").doc(currentChatInfo.id).collection("messages").orderBy("timestamp", "asc").limitToLast(50); // جلب آخر 50 رسالة

            console.log("Setting up new message listener for chat ID:", currentChatInfo.id);
            unsubscribeMessages = messagesQuery.onSnapshot(snapshot => {
                console.log("Received message snapshot for chat:", currentChatInfo.id, "Docs count:", snapshot.docs.length);
                if (snapshot.empty && messagesContainerMain.innerHTML === '') { // إذا كانت فارغة ولم يتم تحميل شيء بعد
                     messagesContainerMain.innerHTML = '<p style="text-align:center; color:#888;">لا توجد رسائل بعد. ابدأ المحادثة!</p>';
                     return;
                }
                
                snapshot.docChanges().forEach(change => {
                    if (change.type === "added") {
                        const msgData = change.doc.data();
                        console.log("New message added:", msgData);
                        addMessageToChatView({
                            type: msgData.senderId === currentUserData.uid ? 'sent' : 'received',
                            text: msgData.text,
                            timestamp: msgData.timestamp ? msgData.timestamp.toDate().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : 'الآن'
                            // يمكنك إضافة حقل status هنا إذا قمت بتخزينه وقراءته من Firestore
                        });
                    }
                    // يمكنك إضافة معالجة لـ change.type === "modified" أو "removed" إذا احتجت
                });
            }, error => {
                console.error("Error listening to messages for chat:", currentChatInfo.id, error);
                if(messagesContainerMain) messagesContainerMain.innerHTML = '<p style="text-align:center; color:red;">خطأ في تحميل الرسائل.</p>';
            });
            showAppSection('chat-view-container');
            if(messageInputFieldMain) messageInputFieldMain.focus();
        }

        function addMessageToChatView(message) {
            if(!messagesContainerMain) return;
            const item = document.createElement('div');
            item.className = `message-item ${message.type}`;
            // إضافة اسم المرسل للرسائل المستقبلة (اختياري)
            let senderNamePrefix = '';
            // if (message.type === 'received' && currentChatInfo && message.senderName) {
            //     senderNamePrefix = `<small style="display:block; color:#555; margin-bottom:2px;">${message.senderName}</small>`;
            // }
            item.innerHTML = `<div class="message-bubble">${senderNamePrefix}<p class="message-text">${message.text}</p><span class="message-timestamp">${message.timestamp}</span></div>`;
            
            // إزالة رسالة "لا توجد رسائل" إذا كانت موجودة
            const noMessagesP = messagesContainerMain.querySelector('p[style*="لا توجد رسائل"]');
            if (noMessagesP) noMessagesP.remove();

            messagesContainerMain.appendChild(item);
            messagesContainerMain.scrollTop = messagesContainerMain.scrollHeight;
        }

        if(sendMessageButtonMain && messageInputFieldMain){
            sendMessageButtonMain.onclick = async () => {
                const text = messageInputFieldMain.value.trim();
                if (text === '' || !currentChatInfo || !currentChatInfo.id || !currentUserData.uid) {
                    console.warn("Cannot send message: missing text, chat info, or user UID.");
                    return;
                }

                const messageData = { 
                    senderId: currentUserData.uid,
                    senderName: currentUserData.displayName || currentUserData.email.split('@')[0], // اسم مرسل الرسالة
                    text: text, 
                    timestamp: firebase.firestore.FieldValue.serverTimestamp() // طابع زمني من الخادم
                };

                console.log("Sending message to chat ID:", currentChatInfo.id, messageData);
                try {
                    // إضافة الرسالة إلى Firestore
                    await db.collection('chats').doc(currentChatInfo.id).collection('messages').add(messageData);
                    messageInputFieldMain.value = '';
                    console.log("Message sent successfully to Firestore.");
                    // onSnapshot سيتولى عرض الرسالة في واجهة المرسل
                } catch (error) {
                    console.error("Error sending message to Firestore:", error);
                    alert("خطأ في إرسال الرسالة: " + error.message);
                }
            };
            messageInputFieldMain.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessageButtonMain.click(); });
        }
        
        if(backToChatsListBtn) {
            backToChatsListBtn.onclick = () => { 
                if(unsubscribeMessages) {
                    console.log("Unsubscribing from messages on back button.");
                    unsubscribeMessages();
                    unsubscribeMessages = null;
                }
                currentChatInfo = null; // مسح معلومات الدردشة الحالية
                showAppSection('chats-container'); 
            };
        }

        // --- تعديل معالج النقر على قائمة الدردشات (chatListULMain) ---
        // هذا الجزء يحتاج إلى قائمة مستخدمين حقيقية أو طريقة لاختيار مع من تريد الدردشة.
        // حاليًا، المثال الثابت في HTML سيفتح دائمًا نفس الدردشة "chat_general".
        // لإنشاء دردشات فردية، ستحتاج إلى:
        // 1. قائمة بجهات الاتصال أو المستخدمين الآخرين.
        // 2. عند النقر على مستخدم، يتم إنشاء chatId فريد بين المستخدم الحالي والمستخدم المختار.
        
        // مثال لكيفية تعديل النقر على عنصر قائمة الدردشات (إذا كان لديك بيانات المستخدمين)
        if(chatListULMain){
            chatListULMain.innerHTML = ''; // مسح القائمة الوهمية الأولية
            // مثال: إضافة مستخدم وهمي آخر لقائمة الدردشات
            const usersToChatWith = [
                { uid: "USER_B_UID", name: "صديق ب", avatar: "placeholder.png" }, // استبدل USER_B_UID بمعرف حقيقي
                { uid: "USER_C_UID", name: "زميل ج", avatar: "placeholder.png" }  // استبدل USER_C_UID بمعرف حقيقي
            ];

            // إضافة "دردشة عامة" أولاً
            const generalChatLi = document.createElement('li');
            generalChatLi.className = 'chat-list-item';
            generalChatLi.dataset.chatid = "chat_general"; // معرف دردشة عامة
            generalChatLi.dataset.chatname = "دردشة عامة";
            generalChatLi.dataset.partneruid = "general"; // لا يوجد شريك محدد
            generalChatLi.dataset.chatavatar = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM4ODgiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjEgMTZoLTQgYTEgMSAwIDAgMC0xIDFsLTMgMmgtM2wtMy0yIGExIDEgMCAwIDAtMSAxdjRoMTZ2LTR6Ij48L3BhdGg+PHBhdGggZD0iTTIgMTJoMi40NWE1IDUgMCAwIDEgMy44My0xLjc5TDEyIDEybDMuNzItMS43OWExLjQ5IDEuNDkgMCAwIDEgMS4xOC0uMTVoMGExLjQ5IDEuNDkgMCAwIDEgMS4xOC4xNUwxNyAxMmgyLjM1YTEuMzcgMS4zNyAwIDAgMSAxLjE1IDEuOVYxNSI+PC9wYXRoPjxwYXRoIGQ9Ik0xMiA4bC0yIDJoNGwtMi0yeiI+PC9wYXRoPjwvZXZnPg==";
            generalChatLi.innerHTML = `<img src="${generalChatLi.dataset.chatavatar}" alt="ص" class="chat-avatar"><div class="chat-info"><span class="chat-name">دردشة عامة</span><span class="chat-last-message">مرحباً بالجميع!</span></div>`;
            chatListULMain.appendChild(generalChatLi);


            usersToChatWith.forEach(user => {
                if (currentUserData.uid && user.uid !== currentUserData.uid) { // لا تضف المستخدم الحالي لقائمة الدردشة مع نفسه
                    const li = document.createElement('li');
                    li.className = 'chat-list-item';
                    // chatId للمحادثات الفردية
                    li.dataset.chatid = generateChatId(currentUserData.uid, user.uid);
                    li.dataset.partneruid = user.uid; // معرف الطرف الآخر
                    li.dataset.chatname = user.name;
                    li.dataset.chatavatar = user.avatar;
                    li.innerHTML = `<img src="${user.avatar}" alt="ص" class="chat-avatar"><div class="chat-info"><span class="chat-name">${user.name}</span><span class="chat-last-message">انقر للدردشة...</span></div>`;
                    chatListULMain.appendChild(li);
                }
            });

            chatListULMain.addEventListener('click', function(event){
                const listItem = event.target.closest('.chat-list-item');
                if(listItem && listItem.dataset.chatid){
                    const chatPartnerForView = {
                        uid: listItem.dataset.partneruid, // هذا هو uid الطرف الآخر للدردشة الفردية
                        name: listItem.dataset.chatname,
                        avatar: listItem.dataset.chatavatar,
                        // id للدردشة (مستند الدردشة في Firestore) هو listItem.dataset.chatid
                    };
                    openChatView(chatPartnerForView); // نمرر بيانات الشريك
                }
            });
        }
        
        // ... (باقي معالجات الأزرار الأخرى مثل FAB, search, menu, logout تبقى كما هي) ...
        // ... (دوال showAppSection, initializeApplication, إلخ) ...

        // تأكد من استدعاء initializeApplication بعد تهيئة Firebase
        // تم ذلك بالفعل عبر الحدث 'firebaseReadyForApp'

    // }); // نهاية document.addEventListener('firebaseReadyForApp', ...) - تأكد من أن هذا القوس موجود
    // تم إغلاقه في الكود السابق، لكن أعدت كتابته للتأكيد.